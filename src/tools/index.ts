import type { AgentTool } from "@mariozechner/pi-agent-core";
import { helloTool } from "./hello.js";

export const tools: AgentTool<any>[] = [helloTool];
