export type Locale = "en" | "zh-CN";

export const SUPPORTED_LOCALES: Locale[] = ["en", "zh-CN"];

let currentLocale: Locale = "en";
let dictionaries: Record<Locale, Record<string, string>> | null = null;

async function loadDictionaries(): Promise<Record<Locale, Record<string, string>>> {
  if (dictionaries) return dictionaries;
  const en = (await import("./en.js")).default;
  const zhCN = (await import("./zh-CN.js")).default;
  dictionaries = { en, "zh-CN": zhCN };
  return dictionaries;
}

// Pre-load dictionaries
const dictsPromise = loadDictionaries();

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string): string {
  if (!dictionaries) return key;
  const dict = dictionaries[currentLocale];
  return dict?.[key] ?? dictionaries["en"]?.[key] ?? key;
}

// Ensure dictionaries are loaded at import time
await dictsPromise;
