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
import type { OAuthStore } from "../../core/oauth-store.js";

export interface AgentEvent {
  id: number;
  type: string;
  data: Record<string, any>;
}

export interface Session {
  id: string;
  type: "main" | "sub";
  parentId?: string;
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
  private oauthStore?: OAuthStore;

  constructor(
    getConfig: () => Config,
    getRegistry: () => ModelRegistry,
    tools: AgentTool<any>[],
    store: SessionStore,
    oauthStore?: OAuthStore
  ) {
    this.getConfig = getConfig;
    this.getRegistry = getRegistry;
    this.tools = tools;
    this.store = store;
    this.oauthStore = oauthStore;
  }

  private mainSessionId: string | null = null;

  async getOrCreateMain(): Promise<Session> {
    // Check in-memory first
    if (this.mainSessionId && this.sessions.has(this.mainSessionId)) {
      return this.sessions.get(this.mainSessionId)!;
    }

    // Check persisted sessions
    const persisted = await this.store.findMain();
    if (persisted) {
      const session = await this.resume(persisted.id);
      if (session) {
        this.mainSessionId = session.id;
        return session;
      }
    }

    // Create new main session
    const id = uuidv4();
    const { agent, gate, pendingApprovals, sessionRef } = this.createAgentWithGate();
    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef, undefined, "main");
    this.mainSessionId = id;

    // Persist immediately
    this.persistSession(session).catch(() => {});

    return session;
  }

  createSubAgent(parentId?: string, taskPrompt?: string, spawnedBy: "user" | "agent" = "user"): Session {
    const id = uuidv4();
    const { agent, gate, pendingApprovals, sessionRef } = this.createAgentWithGate(spawnedBy === "agent");
    const resolvedParentId = parentId ?? this.mainSessionId ?? undefined;
    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef, undefined, "sub", resolvedParentId);

    // Persist immediately with sub-agent metadata
    this.persistSubSession(session, spawnedBy, taskPrompt).catch(() => {});

    return session;
  }

  /**
   * Archive the current main session (save as "sub") and create a fresh main session.
   * Returns the new main session.
   */
  async archiveAndResetMain(): Promise<Session> {
    const oldMain = this.mainSessionId ? this.sessions.get(this.mainSessionId) : undefined;

    if (oldMain) {
      // Abort if streaming
      if (oldMain.agent.state.isStreaming) {
        oldMain.agent.abort();
      }

      const messages = oldMain.agent.state.messages;
      if (messages.length > 0) {
        // Re-save the old main as type "sub" so it appears in history
        const cleaned = SessionManager.sanitizeMessages(messages);
        const persisted = {
          id: oldMain.id,
          type: "sub" as const,
          parentId: undefined,
          spawnedBy: "user" as const,
          title: SessionStore.deriveTitle(
            cleaned.map((m: any) => ({ role: m.role, content: m.content })),
            "sub"
          ),
          createdAt: oldMain.createdAt,
          updatedAt: Date.now(),
          modelId: oldMain.agent.state.model.id,
          messages: cleaned.map((m: any) => ({ role: m.role, content: m.content })),
        };
        await this.store.save(persisted);
      } else {
        // No messages — just delete the old file
        await this.store.delete(oldMain.id).catch(() => {});
      }

      // Remove from memory
      this.sessions.delete(oldMain.id);
    }

    // Create a new main session
    this.mainSessionId = null;
    return this.getOrCreateMain();
  }

  getMainSessionId(): string | null {
    return this.mainSessionId;
  }

  create(): Session {
    const id = uuidv4();
    const { agent, gate, pendingApprovals, sessionRef } = this.createAgentWithGate();
    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef, undefined, "sub");

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

    // Replay messages (sanitize to clean up any broken history from past crashes/aborts)
    if (persisted.messages.length > 0) {
      const cleaned = SessionManager.sanitizeMessages(persisted.messages);
      agent.replaceMessages(cleaned as any);
    }

    const session = this.setupSession(id, agent, gate, pendingApprovals, sessionRef, persisted.createdAt, persisted.type ?? "sub", persisted.parentId);
    if (persisted.type === "main") {
      this.mainSessionId = id;
    }
    return session;
  }

  private createAgentWithGate(autoApprove = false) {
    const pendingApprovals = new Map<string, { resolve: (d: ApprovalDecision) => void; command: string }>();
    const gate = createApprovalGate();
    const sessionRef: { session: Session | null } = { session: null };

    if (autoApprove) {
      // Agent-spawned sub-agents auto-approve all commands
      // because no SSE client will be connected to respond to approval requests
      gate.requestApproval = async () => "allow" as ApprovalDecision;
    } else {
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
    }

    const shellExecTool = createShellExecTool(gate);
    const allTools = [...this.tools, shellExecTool];
    const agent = createAgent(this.getConfig(), this.getRegistry(), allTools, this.oauthStore);

    return { agent, gate, pendingApprovals, sessionRef };
  }

  private setupSession(
    id: string,
    agent: Agent,
    gate: ApprovalGate,
    pendingApprovals: Map<string, { resolve: (d: ApprovalDecision) => void; command: string }>,
    sessionRef: { session: Session | null },
    createdAt?: number,
    type: "main" | "sub" = "sub",
    parentId?: string
  ): Session {
    const session: Session = {
      id,
      type,
      parentId,
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
    const cleaned = SessionManager.sanitizeMessages(session.agent.state.messages);
    const messages = cleaned.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const persisted: PersistedSession = {
      id: session.id,
      type: session.type,
      parentId: session.parentId,
      title: SessionStore.deriveTitle(messages, session.type),
      createdAt: session.createdAt,
      updatedAt: Date.now(),
      modelId: session.agent.state.model.id,
      messages,
    };

    await this.store.save(persisted);
  }

  private async persistSubSession(session: Session, spawnedBy: "user" | "agent", taskPrompt?: string): Promise<void> {
    const cleaned = SessionManager.sanitizeMessages(session.agent.state.messages);
    const messages = cleaned.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const persisted: PersistedSession = {
      id: session.id,
      type: "sub",
      parentId: session.parentId,
      spawnedBy,
      taskPrompt,
      title: SessionStore.deriveTitle(messages, "sub"),
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
    // Protect main agent from deletion
    if (id === this.mainSessionId) return false;
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

    // Sanitize message history before sending to API to avoid
    // broken context from aborted/errored calls (empty assistant messages,
    // thinking-only messages, orphaned toolResults)
    const cleaned = SessionManager.sanitizeMessages(session.agent.state.messages);
    if (cleaned.length !== session.agent.state.messages.length) {
      session.agent.replaceMessages(cleaned as any);
    }

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

  /**
   * Remove broken messages from history that cause API errors.
   *
   * Handles: empty/thinking-only assistant messages, incomplete tool call
   * chains (abort mid-execution), and consecutive user messages that result
   * from removing broken entries.
   *
   * Tool association: assistant with N toolCalls is followed by exactly N
   * toolResult messages (positional, no ID matching).
   */
  static sanitizeMessages(messages: any[]): any[] {
    const result: any[] = [];
    let i = 0;

    while (i < messages.length) {
      const m = messages[i];

      if (m.role === "assistant") {
        const hasText = Array.isArray(m.content)
          ? m.content.some((b: any) => b.type === "text" && b.text?.trim())
          : typeof m.content === "string" && m.content.trim();
        const toolCallCount = Array.isArray(m.content)
          ? m.content.filter((b: any) => b.type === "toolCall" || b.type === "tool_use").length
          : 0;

        // Skip empty assistant messages (no text, no tool calls)
        if (!hasText && toolCallCount === 0) {
          i++;
          continue;
        }

        if (toolCallCount > 0) {
          // Count how many toolResults actually follow
          let resultCount = 0;
          for (let j = i + 1; j < messages.length && messages[j].role === "toolResult"; j++) {
            resultCount++;
          }

          if (resultCount < toolCallCount) {
            // Incomplete tool chain (e.g. abort mid-execution)
            // Skip this assistant + however many toolResults exist
            i += 1 + resultCount;
            continue;
          }

          // Complete chain — keep assistant + its toolResults
          result.push(m);
          i++;
          for (let n = 0; n < toolCallCount; n++) {
            result.push(messages[i]);
            i++;
          }
          continue;
        }

        // Text-only assistant message
        result.push(m);
        i++;
      } else if (m.role === "toolResult") {
        // Orphaned toolResult (no preceding assistant with toolCall) — skip
        i++;
      } else {
        // user / system
        result.push(m);
        i++;
      }
    }

    return result;
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
