import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../../../core/config.js";
import {
  validateConfig,
  maskApiKey,
  isApiKeyMasked,
} from "../../../core/config-validator.js";
import { KNOWN_API_TYPES, getKnownProviders, fetchModelsForProvider } from "../../../core/config.js";
import type { OAuthStore } from "../../../core/oauth-store.js";
import { getOAuthProviders } from "@mariozechner/pi-ai/oauth";

export function configRoutes(
  getConfig: () => Config,
  onConfigSaved: () => Promise<void>,
  oauthStore?: OAuthStore
): FastifyPluginAsync {
  return async (app) => {
    const configPath = resolve(process.cwd(), "config.json");

    // GET /api/config — return config with masked API keys + known options
    app.get("/", async () => {
      const config = getConfig();
      const masked = JSON.parse(JSON.stringify(config));
      if (masked.providers) {
        for (const provider of Object.values(masked.providers) as any[]) {
          if (provider.apiKey) {
            provider.apiKey = maskApiKey(provider.apiKey);
          }
        }
      }

      // Build OAuth status map
      const oauthStatuses: Record<string, { authenticated: boolean; expires?: number }> = {};
      if (oauthStore) {
        const allCreds = await oauthStore.loadAll();
        const providers = getOAuthProviders();
        for (const p of providers) {
          const creds = allCreds[p.id];
          oauthStatuses[p.id] = {
            authenticated: !!creds,
            expires: creds?.expires,
          };
        }
      }

      return {
        ...masked,
        _meta: {
          knownApiTypes: KNOWN_API_TYPES,
          knownProviders: getKnownProviders(),
          oauthStatuses,
        },
      };
    });

    // PUT /api/config — validate, save, and hot-reload config
    app.put("/", async (req, reply) => {
      const newConfig = req.body as any;

      // Restore masked API keys from current config
      const currentConfig = getConfig();
      if (newConfig.providers && currentConfig.providers) {
        for (const [name, provider] of Object.entries(newConfig.providers) as [
          string,
          any,
        ][]) {
          if (
            provider.apiKey &&
            isApiKeyMasked(provider.apiKey) &&
            currentConfig.providers[name]
          ) {
            provider.apiKey = currentConfig.providers[name].apiKey;
          }
        }
      }

      const { valid, errors } = validateConfig(newConfig);
      if (!valid) {
        reply.code(400);
        return { ok: false, errors };
      }

      // Write to disk (async, non-blocking)
      await writeFile(configPath, JSON.stringify(newConfig, null, 2), "utf-8");

      // Hot-reload
      await onConfigSaved();

      return { ok: true };
    });

    // PATCH /api/config/locale — update only the locale field (avoids API key corruption)
    app.patch("/locale", async (req, reply) => {
      const { locale } = req.body as { locale: string };
      if (!locale || !["en", "zh-CN"].includes(locale)) {
        reply.code(400);
        return { ok: false, errors: ["locale must be 'en' or 'zh-CN'"] };
      }

      const raw = readFileSync(configPath, "utf-8");
      const currentConfig = JSON.parse(raw);
      currentConfig.locale = locale;
      await writeFile(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");
      await onConfigSaved();
      return { ok: true };
    });

    // GET /api/config/providers/:name/models — fetch models for a specific provider
    app.get("/providers/:name/models", async (req, reply) => {
      const { name } = req.params as { name: string };
      const config = getConfig();
      const provider = config.providers[name];
      if (!provider) {
        reply.code(404);
        return { error: `Provider "${name}" not found` };
      }
      const models = await fetchModelsForProvider(name, provider);
      return { models };
    });

    // GET /api/config/oauth/status — return OAuth authentication status for all providers
    app.get("/oauth/status", async () => {
      const statuses: Record<string, { authenticated: boolean; expires?: number; name: string }> = {};
      if (oauthStore) {
        const allCreds = await oauthStore.loadAll();
        const providers = getOAuthProviders();
        for (const p of providers) {
          const creds = allCreds[p.id];
          statuses[p.id] = {
            name: p.name,
            authenticated: !!creds,
            expires: creds?.expires,
          };
        }
      }
      return { statuses };
    });
  };
}
