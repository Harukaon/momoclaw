import { KNOWN_API_TYPES } from "./config.js";

const VALID_LOCALES = ["en", "zh-CN"];

export function validateConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"] };
  }

  const c = config as Record<string, any>;

  if (typeof c.activeProvider !== "string" || !c.activeProvider) {
    errors.push("activeProvider is required and must be a string");
  }

  if (typeof c.defaultModel !== "string" || !c.defaultModel) {
    errors.push("defaultModel is required and must be a string");
  }

  if (typeof c.systemPrompt !== "string") {
    errors.push("systemPrompt must be a string");
  }

  if (c.locale !== undefined && !VALID_LOCALES.includes(c.locale)) {
    errors.push(`locale must be one of: ${VALID_LOCALES.join(", ")}`);
  }

  if (!c.providers || typeof c.providers !== "object") {
    errors.push("providers must be an object");
  } else {
    for (const [name, provider] of Object.entries(c.providers)) {
      const p = provider as any;
      if (!p || typeof p !== "object") {
        errors.push(`providers.${name} must be an object`);
        continue;
      }
      if (typeof p.api !== "string" || !p.api) {
        errors.push(`providers.${name}.api is required and must be a string`);
      }
      if (typeof p.apiKey !== "string") {
        errors.push(`providers.${name}.apiKey must be a string`);
      }
      if (p.baseUrl !== undefined && typeof p.baseUrl !== "string") {
        errors.push(`providers.${name}.baseUrl must be a string`);
      }
    }

    if (
      typeof c.activeProvider === "string" &&
      c.activeProvider &&
      !c.providers[c.activeProvider]
    ) {
      errors.push(
        `activeProvider "${c.activeProvider}" does not exist in providers`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return key ? "****" : "";
  return key.slice(0, 4) + "..." + key.slice(-4);
}

export function isApiKeyMasked(key: string): boolean {
  return /^.{4}\.\.\..{4}$/.test(key);
}
