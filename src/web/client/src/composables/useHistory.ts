import { ref, computed } from "vue";

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

const sessions = ref<SessionSummary[]>([]);

export function useHistory() {
  async function fetchSessions(): Promise<void> {
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      sessions.value = data.sessions ?? [];
    } catch {
      sessions.value = [];
    }
  }

  async function deleteSession(id: string): Promise<void> {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    sessions.value = sessions.value.filter((s) => s.id !== id);
  }

  async function renameSession(id: string, title: string): Promise<void> {
    await fetch(`/api/sessions/${id}/title`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const s = sessions.value.find((s) => s.id === id);
    if (s) s.title = title;
  }

  return {
    sessions: computed(() => sessions.value),
    fetchSessions,
    deleteSession,
    renameSession,
  };
}
