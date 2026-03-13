import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const HelloParams = Type.Object({
  name: Type.String({ description: "The name of the person to greet" }),
});

type HelloParams = Static<typeof HelloParams>;

export const helloTool: AgentTool<typeof HelloParams> = {
  name: "hello",
  label: "Hello",
  description: "Say hello to someone. Use this when the user asks you to greet someone.",
  parameters: HelloParams,
  execute: async (_toolCallId, params) => {
    const greeting = `Hello, ${params.name}! Nice to meet you.`;
    return {
      content: [{ type: "text", text: greeting }],
      details: { name: params.name },
    };
  },
};
