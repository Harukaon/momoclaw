import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TUI } from "@mariozechner/pi-tui";
import type { Config, ModelRegistry } from "./config.js";
import { getActiveProvider } from "./config.js";
import type { ChatView } from "./ui/chat.js";
import type { InputView } from "./ui/input.js";

export function createAgent(
  config: Config,
  registry: ModelRegistry,
  agentTools: AgentTool<any>[],
  chatView: ChatView,
  inputView: InputView,
  tui: TUI,
): Agent {
  const model = registry.resolve(config.defaultModel);
  const provider = getActiveProvider(config);

  const agent = new Agent({
    initialState: {
      systemPrompt: config.systemPrompt,
      model,
      tools: agentTools,
    },
    getApiKey: async () => provider.apiKey || undefined,
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
