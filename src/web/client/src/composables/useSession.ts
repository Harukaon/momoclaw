import { ref, computed } from "vue";

const sessionId = ref<string | null>(null);
const sessionModel = ref<string>("");
const loading = ref(false);
const mainSessionId = ref<string | null>(null);

export function useSession() {
  async function ensureMainSession(): Promise<string> {
    loading.value = true;
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      mainSessionId.value = data.id;
      sessionId.value = data.id;
      return data.id;
    } finally {
      loading.value = false;
    }
  }

  async function createSubAgent(taskPrompt?: string): Promise<string> {
    loading.value = true;
    try {
      const res = await fetch("/api/sessions/sub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: mainSessionId.value, taskPrompt }),
      });
      const data = await res.json();
      sessionId.value = data.id;
      return data.id;
    } finally {
      loading.value = false;
    }
  }

  async function loadSession(id: string): Promise<any | null> {
    loading.value = true;
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      sessionId.value = data.id;
      sessionModel.value = data.model;
      return data;
    } finally {
      loading.value = false;
    }
  }

  function setSessionId(id: string) {
    sessionId.value = id;
  }

  function isMainSession(id: string): boolean {
    return id === mainSessionId.value;
  }

  async function deleteSession(): Promise<void> {
    if (!sessionId.value) return;
    if (isMainSession(sessionId.value)) return;
    await fetch(`/api/sessions/${sessionId.value}`, { method: "DELETE" });
    sessionId.value = null;
  }

  return {
    sessionId: computed(() => sessionId.value),
    sessionModel: computed(() => sessionModel.value),
    mainSessionId: computed(() => mainSessionId.value),
    loading: computed(() => loading.value),
    ensureMainSession,
    createSubAgent,
    loadSession,
    setSessionId,
    isMainSession,
    deleteSession,
  };
}
