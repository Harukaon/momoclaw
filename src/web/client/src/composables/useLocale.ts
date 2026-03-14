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

    // Persist to server via dedicated locale endpoint (avoids touching API keys)
    try {
      await fetch("/api/config/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch {
      // non-critical, locale is already set client-side
    }
  }

  return { locale, t, setLocale };
}
