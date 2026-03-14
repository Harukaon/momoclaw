import { ref, computed, reactive, type Ref } from "vue";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  done: boolean;
}

export interface ToolExecution {
  toolCallId: string;
  toolName: string;
  status: "running" | "done" | "error";
}

export interface SessionChatState {
  messages: ChatMessage[];
  toolExecutions: ToolExecution[];
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
      messages: [],
      toolExecutions: [],
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
      state.messages.push({
        id,
        role: "assistant",
        content: "",
        done: false,
      });
    }
  });

  es.addEventListener("text_delta", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    if (state.currentAssistantId) {
      const msg = state.messages.find((m) => m.id === state.currentAssistantId);
      if (msg) {
        msg.content += data.delta;
      }
    }
  });

  es.addEventListener("message_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    if (data.role === "assistant" && state.currentAssistantId) {
      const msg = state.messages.find((m) => m.id === state.currentAssistantId);
      if (msg) {
        msg.done = true;
      }
      state.currentAssistantId = null;
    }
  });

  es.addEventListener("tool_execution_start", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    state.toolExecutions.push({
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      status: "running",
    });
  });

  es.addEventListener("tool_execution_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    const exec = state.toolExecutions.find(
      (t) => t.toolCallId === data.toolCallId
    );
    if (exec) {
      exec.status = data.isError ? "error" : "done";
    }
  });

  es.addEventListener("agent_end", (e: MessageEvent) => {
    trackId(e);
    const data = JSON.parse(e.data);
    state.isStreaming = false;
    if (data.error) {
      state.error = data.error;
    }
    // Clean up completed tool executions
    state.toolExecutions = state.toolExecutions.filter(
      (t) => t.status === "running"
    );
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
    state.messages = [];
    state.toolExecutions = [];
    state.currentAssistantId = null;
    state.isStreaming = isStreaming ?? false;

    for (const m of msgs) {
      const role = m.role as "user" | "assistant" | "system";
      let content: string;
      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = (m.content as any[])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
      } else {
        content = "";
      }
      state.messages.push({
        id: nextId(),
        role,
        content,
        done: true,
      });
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
    state.messages = [];
    state.toolExecutions = [];
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
    state.messages.push({
      id: nextId(),
      role: "user",
      content: message,
      done: true,
    });

    // Ensure SSE is connected before sending
    connectStream(sessionId);

    await fetch(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }

  async function abortStream(sessionId: string) {
    await fetch(`/api/sessions/${sessionId}/abort`, { method: "POST" });
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
    // Active session reactive state
    messages: computed(() => currentState.value?.messages ?? []),
    toolExecutions: computed(() => currentState.value?.toolExecutions ?? []),
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
    switchModel,
  };
}
