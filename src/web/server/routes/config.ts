import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../../../core/config.js";
import {
  validateConfig,
  maskApiKey,
  isApiKeyMasked,
} from "../../../core/config-validator.js";
import { KNOWN_API_TYPES, getKnownProviders, fetchModelsForProvider } from "../../../core/config.js";

export function configRoutes(
  getConfig: () => Config,
  onConfigSaved: () => Promise<void>
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
      return {
        ...masked,
        _meta: {
          knownApiTypes: KNOWN_API_TYPES,
          knownProviders: getKnownProviders(),
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

      // Write to disk
      writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");

      // Hot-reload
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
  };
}
