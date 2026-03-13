import { ref, computed } from "vue";

export function useConfig() {
  const config = ref<any>(null);
  const loading = ref(false);
  const saveError = ref<string | null>(null);

  async function fetchConfig(): Promise<void> {
    loading.value = true;
    try {
      const res = await fetch("/api/config");
      config.value = await res.json();
    } finally {
      loading.value = false;
    }
  }

  async function saveConfig(
    newConfig: any
  ): Promise<{ ok: boolean; errors?: string[] }> {
    saveError.value = null;
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      const data = await res.json();
      if (!data.ok) {
        saveError.value = (data.errors ?? []).join("; ");
        return { ok: false, errors: data.errors };
      }
      config.value = newConfig;
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      saveError.value = msg;
      return { ok: false, errors: [msg] };
    }
  }

  return {
    config: computed(() => config.value),
    loading: computed(() => loading.value),
    saveError: computed(() => saveError.value),
    fetchConfig,
    saveConfig,
  };
}
