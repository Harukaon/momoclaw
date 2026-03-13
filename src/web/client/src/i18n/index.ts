import { ref } from "vue";
import en from "./en";
import zhCN from "./zh-CN";

export type Locale = "en" | "zh-CN";

const dictionaries: Record<Locale, Record<string, string>> = {
  en,
  "zh-CN": zhCN,
};

export const currentLocale = ref<Locale>("en");

export function t(key: string): string {
  const dict = dictionaries[currentLocale.value];
  return dict?.[key] ?? dictionaries["en"]?.[key] ?? key;
}

export function setLocale(locale: Locale): void {
  currentLocale.value = locale;
}

export function getLocale(): Locale {
  return currentLocale.value;
}
