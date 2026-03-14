import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { t } from "../i18n/index.js";

const SpawnSubAgentParams = Type.Object({
  task: Type.String({ description: "The task for the sub-agent to execute" }),
});

type SpawnSubAgentParams = Static<typeof SpawnSubAgentParams>;

export interface SpawnSubAgentContext {
  createSubAgent(parentId: string | undefined, taskPrompt: string, spawnedBy: "agent"): {
    id: string;
    agent: { prompt(message: string): Promise<void>; state: { messages: any[] } };
  };
  getMainSessionId(): string | null;
}

export function createSpawnSubAgentTool(
  getContext: () => SpawnSubAgentContext
): AgentTool<typeof SpawnSubAgentParams> {
  return {
    name: "spawn_sub_agent",
    label: "Spawn Sub-Agent",
    description: "Spawn a sub-agent to handle a specific task. The sub-agent will execute the task and return its final response.",
    parameters: SpawnSubAgentParams,
    execute: async (_toolCallId, params) => {
      const ctx = getContext();
      const parentId = ctx.getMainSessionId() ?? undefined;
      const session = ctx.createSubAgent(parentId, params.task, "agent");

      // Run the sub-agent's task and wait for completion
      await session.agent.prompt(params.task);

      // Extract the final assistant reply
      const messages = session.agent.state.messages;
      const lastAssistant = [...messages].reverse().find((m: any) => m.role === "assistant");
      let resultText = t("agent.sub_agent_result");
      if (lastAssistant) {
        if (typeof lastAssistant.content === "string") {
          resultText = lastAssistant.content;
        } else if (Array.isArray(lastAssistant.content)) {
          resultText = (lastAssistant.content as any[])
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
        }
      }

      return {
        content: [{ type: "text", text: resultText }],
        details: { subAgentId: session.id },
      };
    },
  };
}
