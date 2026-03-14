import { ref, computed, reactive } from "vue";

export interface ChatMessage {
  type: "message";
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  done: boolean;
}

export interface ToolExecution {
  type: "tool";
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error" | "awaiting_approval";
  command?: string;
}

export type TimelineItem = ChatMessage | ToolExecution;

export interface SessionChatState {
  timeline: TimelineItem[];
  isStreaming: boolean;
  error: string | null;
  eventSource: EventSource | null;
  currentAssistantId: string | null;
  lastEventId: number;
}

/** Per-session state store */
const sessionStates = reactive<Record<string, SessionChatState>>({});

/** Currently viewed session ID */
const activeSessionId = ref<string | null>(null);

/** Optional callback when agent finishes (for refreshing session list etc.) */
let onAgentEndCallback: ((sessionId: string) => void) | null = null;

let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

function getOrCreate(sessionId: string): SessionChatState {
  if (!sessionStates[sessionId]) {
    sessionStates[sessionId] = {
      timeline: [],
      isStreaming: false,
      error: null,
      eventSource: null,
      currentAssistantId: null,
      lastEventId: 0,
    };
  }
  return sessionStates[sessionId];
}

function connectStream(sessionId: string) {
  const state = getOrCreate(sessionId);

  // Already connected
  if (state.eventSource) return;

  // Pass lastEventId as query param so server can replay missed events
  const url = state.lastEventId
    ? `/api/sessions/${sessionId}/stream?lastEventId=${state.lastEventId}`
    : `/api/sessions/${sessionId}/stream`;
  const es = new EventSource(url);
  state.eventSource = es;

  // Track lastEventId from each SSE event for replay on reconnect
  function trackId(e: MessageEvent) {
    if (e.lastEventId) {
      state.lastEventId = parseInt(e.lastEventId, 10) || state.lastEventId;
    }
  }

  es.addEventListener("agent_start", (e: MessageEvent) => {
    trackId(e);
    state.isStreaming = true;
    state.error = null;
  });

  es.addEventListener("message_start", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    if (data.role === "assistant") {
      const id = nextId();
      state.currentAssistantId = id;
      state.timeline.push({
        type: "message",
        id,
        role: "assistant",
        content: "",
        done: false,
      });
    }
    // Ignore toolResult role — tool results are tracked via tool_execution events
  });

  es.addEventListener("text_delta", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    if (state.currentAssistantId) {
      const msg = state.timeline.find(
        (item): item is ChatMessage =>
          item.type === "message" && item.id === state.currentAssistantId
      );
      if (msg) {
        msg.content += data.delta;
      }
    }
  });

  es.addEventListener("message_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    if (data.role === "assistant" && state.currentAssistantId) {
      const msg = state.timeline.find(
        (item): item is ChatMessage =>
          item.type === "message" && item.id === state.currentAssistantId
      );
      if (msg) {
        msg.done = true;
      }
      state.currentAssistantId = null;
    }
  });

  es.addEventListener("tool_execution_start", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    // Dedup: skip if this toolCallId already exists (SSE reconnect replay)
    const exists = state.timeline.some(
      (item) => item.type === "tool" && item.toolCallId === data.toolCallId
    );
    if (exists) return;
    state.timeline.push({
      type: "tool",
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      status: "running",
    });
  });

  es.addEventListener("tool_execution_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    const exec = state.timeline.find(
      (item): item is ToolExecution =>
        item.type === "tool" && item.toolCallId === data.toolCallId
    );
    if (exec) {
      exec.status = data.isError ? "error" : "done";
    }
  });

  es.addEventListener("tool_approval_request", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    const exec = state.timeline.find(
      (item): item is ToolExecution =>
        item.type === "tool" && item.toolCallId === data.toolCallId
    );
    if (exec) {
      exec.status = "awaiting_approval";
      exec.command = data.command;
    }
  });

  es.addEventListener("agent_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    state.isStreaming = false;
    if (data.error) {
      state.error = data.error;
    }
    // Do NOT clean up tool executions — keep done/error/awaiting_approval visible
    // Disconnect SSE when agent finishes — will reconnect on next send
    disconnectSession(sessionId);
    // Notify callback (e.g., to refresh session list)
    if (onAgentEndCallback) onAgentEndCallback(sessionId);
  });

  es.onerror = () => {
    // EventSource will auto-reconnect
  };
}

function disconnectSession(sessionId: string) {
  const state = sessionStates[sessionId];
  if (!state?.eventSource) return;
  state.eventSource.close();
  state.eventSource = null;
}

export function useChat() {
  /** Set which session the UI is currently viewing */
  function setActiveSession(sessionId: string | null) {
    activeSessionId.value = sessionId;
  }

  /** Restore messages from backend into a session's state */
  function restoreMessages(
    sessionId: string,
    msgs: Array<{ role: string; content: any }>,
    isStreaming?: boolean
  ) {
    const state = getOrCreate(sessionId);
    state.timeline = [];
    state.currentAssistantId = null;
    state.isStreaming = isStreaming ?? false;

    for (const m of msgs) {
      const role = m.role as "user" | "assistant" | "system";

      // Skip toolResult messages — tools are tracked separately
      if (m.role === "toolResult") continue;

      let textContent = "";
      const toolCalls: Array<{ id: string; name: string }> = [];

      if (typeof m.content === "string") {
        textContent = m.content;
      } else if (Array.isArray(m.content)) {
        for (const block of m.content as any[]) {
          if (block.type === "text") {
            textContent += block.text;
          } else if (block.type === "tool_use" || block.type === "toolCall") {
            toolCalls.push({ id: block.id, name: block.name });
          }
        }
      }

      // Skip empty assistant messages (e.g. only had thinking + toolCall, no text)
      if (role === "assistant" && !textContent && toolCalls.length === 0) continue;

      // Push the message only if it has text content
      if (textContent) {
        state.timeline.push({
          type: "message",
          id: nextId(),
          role,
          content: textContent,
          done: true,
        });
      }

      // For assistant messages, insert tool executions after the message
      if (role === "assistant") {
        for (const tc of toolCalls) {
          state.timeline.push({
            type: "tool",
            toolCallId: tc.id,
            toolName: tc.name,
            status: "done",
          });
        }
      }
    }

    // If backend says it's still streaming, connect SSE to continue receiving
    if (isStreaming) {
      connectStream(sessionId);
    }
  }

  /** Clear a session's state (or current active if no id given) */
  function clearSession(sessionId: string) {
    const state = getOrCreate(sessionId);
    disconnectSession(sessionId);
    state.timeline = [];
    state.currentAssistantId = null;
    state.isStreaming = false;
    state.error = null;
  }

  /** Remove a session from the state map entirely */
  function removeSession(sessionId: string) {
    disconnectSession(sessionId);
    delete sessionStates[sessionId];
  }

  /** Disconnect all SSE connections */
  function disconnectAll() {
    for (const sid of Object.keys(sessionStates)) {
      disconnectSession(sid);
    }
  }

  async function sendMessage(sessionId: string, message: string) {
    const state = getOrCreate(sessionId);
    state.timeline.push({
      type: "message",
      id: nextId(),
      role: "user",
      content: message,
      done: true,
    });

    // Ensure SSE is connected before sending
    connectStream(sessionId);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // If agent is already streaming, sync our state
        if (data.error?.includes("already streaming")) {
          state.isStreaming = true;
          connectStream(sessionId);
        }
        state.error = data.error || `Send failed (${res.status})`;
      }
    } catch {
      state.error = "Network error";
    }
  }

  async function abortStream(sessionId: string) {
    await fetch(`/api/sessions/${sessionId}/abort`, { method: "POST" });
  }

  async function approveToolCall(
    sessionId: string,
    toolCallId: string,
    decision: "allow" | "deny" | "always",
  ) {
    await fetch(`/api/sessions/${sessionId}/tool-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolCallId, decision }),
    });
  }

  async function switchModel(sessionId: string, model: string) {
    await fetch(`/api/sessions/${sessionId}/model`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
  }

  /** Check if a specific session is streaming */
  function isSessionStreaming(sessionId: string): boolean {
    return sessionStates[sessionId]?.isStreaming ?? false;
  }

  /** Register a callback for when any session's agent finishes */
  function onAgentEnd(cb: (sessionId: string) => void) {
    onAgentEndCallback = cb;
  }

  // Computed properties that reflect the ACTIVE session's state
  const currentState = computed<SessionChatState | null>(() => {
    const sid = activeSessionId.value;
    if (!sid) return null;
    return sessionStates[sid] ?? null;
  });

  return {
    // Active session reactive state — unified timeline
    timeline: computed(() => currentState.value?.timeline ?? []),

    // Backward-compatible filtered views
    messages: computed(() =>
      (currentState.value?.timeline ?? []).filter(
        (item): item is ChatMessage => item.type === "message"
      )
    ),
    toolExecutions: computed(() =>
      (currentState.value?.timeline ?? []).filter(
        (item): item is ToolExecution => item.type === "tool"
      )
    ),

    isStreaming: computed(() => currentState.value?.isStreaming ?? false),
    error: computed(() => currentState.value?.error ?? null),

    // Per-session access (for sidebar indicators etc.)
    sessionStates,
    isSessionStreaming,

    // Actions
    setActiveSession,
    restoreMessages,
    clearSession,
    removeSession,
    disconnectAll,
    onAgentEnd,
    sendMessage,
    abortStream,
    approveToolCall,
    switchModel,
  };
}
