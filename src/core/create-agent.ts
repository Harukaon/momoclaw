import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Config, ModelRegistry } from "./config.js";
import { getActiveProvider, getActiveModel } from "./config.js";

export function createAgent(config: Config, registry: ModelRegistry, agentTools: AgentTool<any>[]): Agent {
  const model = registry.resolve(getActiveModel(config));
  const provider = getActiveProvider(config);

  return new Agent({
    initialState: {
      systemPrompt: config.systemPrompt,
      model,
      tools: agentTools,
    },
    getApiKey: async () => provider.apiKey || undefined,
  });
}
