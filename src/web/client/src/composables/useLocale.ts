import { computed } from "vue";
import { currentLocale, setLocale as setI18nLocale, t as translate } from "../i18n";
import type { Locale } from "../i18n";

export function useLocale() {
  const locale = computed(() => currentLocale.value);

  function t(key: string): string {
    return translate(key);
  }

  async function setLocale(newLocale: Locale): Promise<void> {
    setI18nLocale(newLocale);

    // Persist to server
    try {
      const res = await fetch("/api/config");
      const config = await res.json();
      config.locale = newLocale;
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch {
      // non-critical, locale is already set client-side
    }
  }

  return { locale, t, setLocale };
}
