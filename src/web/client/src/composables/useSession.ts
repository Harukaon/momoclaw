import { ref, computed } from "vue";

const sessionId = ref<string | null>(null);
const sessionModel = ref<string>("");
const loading = ref(false);

export function useSession() {
  async function createSession(): Promise<string> {
    loading.value = true;
    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      sessionId.value = data.id;
      return data.id;
    } finally {
      loading.value = false;
    }
  }

  async function loadSession(id: string): Promise<boolean> {
    loading.value = true;
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) return false;
      const data = await res.json();
      sessionId.value = data.id;
      sessionModel.value = data.model;
      return true;
    } finally {
      loading.value = false;
    }
  }

  async function deleteSession(): Promise<void> {
    if (!sessionId.value) return;
    await fetch(`/api/sessions/${sessionId.value}`, { method: "DELETE" });
    sessionId.value = null;
  }

  return {
    sessionId: computed(() => sessionId.value),
    sessionModel: computed(() => sessionModel.value),
    loading: computed(() => loading.value),
    createSession,
    loadSession,
    deleteSession,
  };
}
