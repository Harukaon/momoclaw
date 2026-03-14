import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TUI } from "@mariozechner/pi-tui";
import { getOAuthApiKey } from "@mariozechner/pi-ai/oauth";
import type { Config, ModelRegistry } from "../core/config.js";
import { getActiveProvider, getActiveModel } from "../core/config.js";
import type { OAuthStore } from "../core/oauth-store.js";
import type { ChatView } from "./ui/chat.js";
import type { InputView } from "./ui/input.js";

export function createCliAgent(
  config: Config,
  registry: ModelRegistry,
  agentTools: AgentTool<any>[],
  chatView: ChatView,
  inputView: InputView,
  tui: TUI,
  oauthStore?: OAuthStore,
): Agent {
  const model = registry.resolve(getActiveModel(config));
  const provider = getActiveProvider(config);
  const activeProviderName = config.activeProvider;

  const agent = new Agent({
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

  agent.subscribe((event) => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role === "assistant") {
          chatView.startAssistantMessage();
        }
        break;
      }

      case "message_update": {
        if (event.assistantMessageEvent.type === "text_delta") {
          chatView.appendAssistantText(event.assistantMessageEvent.delta);
        }
        break;
      }

      case "message_end": {
        if (event.message.role === "assistant") {
          chatView.endAssistantMessage();
        }
        break;
      }

      case "tool_execution_start": {
        chatView.showToolStart(event.toolCallId, event.toolName);
        break;
      }

      case "tool_execution_end": {
        chatView.showToolEnd(event.toolCallId, event.toolName, event.isError);
        break;
      }

      case "agent_end": {
        if (agent.state.error) {
          chatView.showError(agent.state.error);
        }
        inputView.enable();
        inputView.focus(tui);
        break;
      }
    }
  });

  return agent;
}
