import { v4 as uuidv4 } from "uuid";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Config, ModelRegistry } from "../../core/config.js";
import { createAgent } from "../../core/create-agent.js";
import { SessionStore } from "../../core/session-store.js";
import type { PersistedSession } from "../../core/session-store.js";
import {
  createApprovalGate,
  createShellExecTool,
  type ApprovalGate,
  type ApprovalDecision,
} from "../../core/tools/index.js";

export interface AgentEvent {
  id: number;
  type: string;
  data: Record<string, any>;
}

export interface Session {
  id: string;
  agent: Agent;
  eventBuffer: AgentEvent[];
  lastEventId: number;
  createdAt: number;
  sseClients: Set<(event: AgentEvent) => void>;
  approvalGate: ApprovalGate;
  pendingApprovals: Map<string, { resolve: (d: ApprovalDecision) => void; command: string }>;
}

export class SessionManager {
  private sessions = new Map<string, Session>();
  private getConfig: () => Config;
  private getRegistry: () => ModelRegistry;
  private tools: AgentTool<any>[];
  private store: SessionStore;

  constructor(
    getConfig: () => Config,
    getRegistry: () => ModelRegistry,
    tools: AgentTool<any>[],
    store: SessionStore
  ) {
    this.getConfig = getConfig;
    this.getRegistry = getRegistry;
    this.tools = tools;
    this.store = store;
  }

  create(): Session {
    const id = uuidv4();
    const { agent, gate, pendingApprovals, sessionRef } = this.createAgentWithGate();
    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef);

    // Persist immediately
    this.persistSession(session).catch(() => {});

    return session;
  }

  async resume(id: string): Promise<Session | null> {
    // Already in memory
    if (this.sessions.has(id)) return this.sessions.get(id)!;

    const persisted = await this.store.load(id);
    if (!persisted) return null;

    const { agent, gate, pendingApprovals, sessionRef } = this.createAgentWithGate();

    // Restore model if possible
    try {
      const model = this.getRegistry().resolve(persisted.modelId);
      agent.setModel(model);
    } catch {
      // keep default model
    }

    // Replay messages
    if (persisted.messages.length > 0) {
      agent.replaceMessages(persisted.messages as any);
    }

    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef, persisted.createdAt);
    return session;
  }

  private createAgentWithGate() {
    const pendingApprovals = new Map<string, { resolve: (d: ApprovalDecision) => void; command: string }>();
    const gate = createApprovalGate();

    // We need a way to broadcast SSE events from the gate.
    // The session ref is set after createAgentWithGate returns, so we use a mutable holder.
    const sessionRef: { session: Session | null } = { session: null };

    gate.requestApproval = async (req) => {
      return new Promise<ApprovalDecision>((resolve) => {
        pendingApprovals.set(req.toolCallId, { resolve, command: req.command });

        const session = sessionRef.session;
        if (session) {
          const sseEvent: AgentEvent = {
            id: ++session.lastEventId,
            type: "tool_approval_request",
            data: {
              toolCallId: req.toolCallId,
              toolName: req.toolName,
              command: req.command,
            },
          };
          session.eventBuffer.push(sseEvent);
          for (const client of session.sseClients) {
            client(sseEvent);
          }
        }
      });
    };

    const shellExecTool = createShellExecTool(gate);
    const allTools = [...this.tools, shellExecTool];
    const agent = createAgent(this.getConfig(), this.getRegistry(), allTools);

    return { agent, gate, pendingApprovals, sessionRef };
  }

  private setupSession(
    id: string,
    agent: Agent,
    gate: ApprovalGate,
    pendingApprovals: Map<string, { resolve: (d: ApprovalDecision) => void; command: string }>,
    sessionRef: { session: Session | null },
    createdAt?: number,
  ): Session {
    const session: Session = {
      id,
      agent,
      eventBuffer: [],
      lastEventId: 0,
      createdAt: createdAt ?? Date.now(),
      sseClients: new Set(),
      approvalGate: gate,
      pendingApprovals,
    };

    // Now that the session object exists, wire up the ref so the gate can emit SSE
    sessionRef.session = session;

    agent.subscribe((event) => {
      const sseEvent = this.mapAgentEvent(session, event);
      if (sseEvent) {
        session.eventBuffer.push(sseEvent);
        // Cap buffer to prevent unbounded memory growth
        if (session.eventBuffer.length > 5000) {
          session.eventBuffer = session.eventBuffer.slice(-2500);
        }
        for (const client of session.sseClients) {
          client(sseEvent);
        }
      }

      // Persist on agent_end
      if (event.type === "agent_end") {
        this.persistSession(session).catch(() => {});
      }
    });

    this.sessions.set(id, session);
    return session;
  }

  private async persistSession(session: Session): Promise<void> {
    const messages = session.agent.state.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const persisted: PersistedSession = {
      id: session.id,
      title: SessionStore.deriveTitle(messages),
      createdAt: session.createdAt,
      updatedAt: Date.now(),
      modelId: session.agent.state.model.id,
      messages,
    };

    await this.store.save(persisted);
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.agent.state.isStreaming) {
      session.agent.abort();
    }
    this.sessions.delete(id);
    this.store.delete(id).catch(() => {});
    return true;
  }

  async prompt(id: string, message: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Session not found");
    if (session.agent.state.isStreaming)
      throw new Error("Agent is already streaming");
    await session.agent.prompt(message);
  }

  abort(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    if (session.agent.state.isStreaming) {
      session.agent.abort();
      return true;
    }
    return false;
  }

  resolveApproval(sessionId: string, toolCallId: string, decision: ApprovalDecision): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const pending = session.pendingApprovals.get(toolCallId);
    if (!pending) return false;
    session.pendingApprovals.delete(toolCallId);
    pending.resolve(decision);
    return true;
  }

  setModel(id: string, modelId: string): void {
    const session = this.sessions.get(id);
    if (!session) throw new Error("Session not found");
    const model = this.getRegistry().resolve(modelId);
    session.agent.setModel(model);
  }

  getModels(): string[] {
    return this.getRegistry().availableModels;
  }

  getStore(): SessionStore {
    return this.store;
  }

  addSseClient(
    id: string,
    client: (event: AgentEvent) => void
  ): (() => void) | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.sseClients.add(client);
    return () => {
      session.sseClients.delete(client);
    };
  }

  getEventsSince(id: string, lastEventId: number): AgentEvent[] {
    const session = this.sessions.get(id);
    if (!session) return [];
    return session.eventBuffer.filter((e) => e.id > lastEventId);
  }

  private mapAgentEvent(session: Session, event: any): AgentEvent | null {
    const id = ++session.lastEventId;

    switch (event.type) {
      case "agent_start":
        return { id, type: "agent_start", data: {} };

      case "message_start":
        return {
          id,
          type: "message_start",
          data: { role: event.message?.role },
        };

      case "message_update": {
        const ame = event.assistantMessageEvent;
        if (ame?.type === "text_delta") {
          return {
            id,
            type: "text_delta",
            data: { delta: ame.delta },
          };
        }
        if (ame?.type === "thinking_delta") {
          return {
            id,
            type: "thinking_delta",
            data: { delta: ame.delta },
          };
        }
        return null;
      }

      case "message_end":
        return {
          id,
          type: "message_end",
          data: { role: event.message?.role },
        };

      case "tool_execution_start":
        return {
          id,
          type: "tool_execution_start",
          data: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
          },
        };

      case "tool_execution_end":
        return {
          id,
          type: "tool_execution_end",
          data: {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            isError: event.isError,
          },
        };

      case "agent_end":
        return {
          id,
          type: "agent_end",
          data: { error: session.agent.state.error },
        };

      default:
        return null;
    }
  }
}
