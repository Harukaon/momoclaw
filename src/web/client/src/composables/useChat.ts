import { ref, computed, type Ref } from "vue";

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

const messages: Ref<ChatMessage[]> = ref([]);
const toolExecutions: Ref<ToolExecution[]> = ref([]);
const isStreaming = ref(false);
const error = ref<string | null>(null);

let eventSource: EventSource | null = null;
let currentAssistantId: string | null = null;
let messageCounter = 0;

function nextId(): string {
  return `msg-${++messageCounter}`;
}

export function useChat() {
  function connectStream(sessionId: string) {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.addEventListener("agent_start", () => {
      isStreaming.value = true;
      error.value = null;
    });

    eventSource.addEventListener("message_start", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.role === "assistant") {
        const id = nextId();
        currentAssistantId = id;
        messages.value.push({
          id,
          role: "assistant",
          content: "",
          done: false,
        });
      }
    });

    eventSource.addEventListener("text_delta", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (currentAssistantId) {
        const msg = messages.value.find((m) => m.id === currentAssistantId);
        if (msg) {
          msg.content += data.delta;
        }
      }
    });

    eventSource.addEventListener("message_end", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      if (data.role === "assistant" && currentAssistantId) {
        const msg = messages.value.find((m) => m.id === currentAssistantId);
        if (msg) {
          msg.done = true;
        }
        currentAssistantId = null;
      }
    });

    eventSource.addEventListener("tool_execution_start", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      toolExecutions.value.push({
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        status: "running",
      });
    });

    eventSource.addEventListener("tool_execution_end", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      const exec = toolExecutions.value.find(
        (t) => t.toolCallId === data.toolCallId
      );
      if (exec) {
        exec.status = data.isError ? "error" : "done";
      }
    });

    eventSource.addEventListener("agent_end", (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      isStreaming.value = false;
      if (data.error) {
        error.value = data.error;
      }
      // Clean up completed tool executions
      toolExecutions.value = toolExecutions.value.filter(
        (t) => t.status === "running"
      );
    });

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  async function sendMessage(sessionId: string, message: string) {
    messages.value.push({
      id: nextId(),
      role: "user",
      content: message,
      done: true,
    });

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

  function clearMessages() {
    messages.value = [];
    toolExecutions.value = [];
    currentAssistantId = null;
  }

  function restoreMessages(
    msgs: Array<{ role: string; content: any }>
  ) {
    clearMessages();
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
      messages.value.push({
        id: nextId(),
        role,
        content,
        done: true,
      });
    }
  }

  return {
    messages: computed(() => messages.value),
    toolExecutions: computed(() => toolExecutions.value),
    isStreaming: computed(() => isStreaming.value),
    error: computed(() => error.value),
    connectStream,
    disconnect,
    sendMessage,
    abortStream,
    switchModel,
    clearMessages,
    restoreMessages,
  };
}
