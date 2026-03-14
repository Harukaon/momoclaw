import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { getOAuthApiKey } from "@mariozechner/pi-ai/oauth";
import type { Config, ModelRegistry } from "./config.js";
import { getActiveProvider, getActiveModel } from "./config.js";
import type { OAuthStore } from "./oauth-store.js";

export function createAgent(
  config: Config,
  registry: ModelRegistry,
  agentTools: AgentTool<any>[],
  oauthStore?: OAuthStore,
): Agent {
  const model = registry.resolve(getActiveModel(config));
  const provider = getActiveProvider(config);
  const activeProviderName = config.activeProvider;

  return new Agent({
    initialState: {
      systemPrompt: config.systemPrompt,
      model,
      tools: agentTools,
    },
    getApiKey: async (_providerName: string) => {
      // 1. Config apiKey — highest priority
      if (provider.apiKey) return provider.apiKey;

      // 2. OAuth credentials (auto-refresh)
      if (oauthStore) {
        try {
          const allCreds = await oauthStore.loadAll();
          const result = await getOAuthApiKey(activeProviderName, allCreds);
          if (result) {
            // Persist refreshed credentials
            await oauthStore.save(activeProviderName, result.newCredentials);
            return result.apiKey;
          }
        } catch {
          // Fall through to undefined
        }
      }

      // 3. undefined — Agent falls back to env vars
      return undefined;
    },
  });
}
