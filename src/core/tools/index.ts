import type { AgentTool } from "@mariozechner/pi-agent-core";
import { fileReadTool } from "./file-read.js";
import { fileWriteTool } from "./file-write.js";
import { createSpawnSubAgentTool } from "./spawn-sub-agent.js";
import type { SpawnSubAgentContext } from "./spawn-sub-agent.js";

export const tools: AgentTool<any>[] = [
  fileReadTool,
  fileWriteTool,
];

export function createToolsWithSubAgent(getContext: () => SpawnSubAgentContext): AgentTool<any>[] {
  return [...tools, createSpawnSubAgentTool(getContext)];
}

export { createShellExecTool } from "./shell-exec.js";
export {
  createApprovalGate,
  checkApproval,
  ApprovalDeniedError,
  type ApprovalGate,
  type ApprovalDecision,
  type ApprovalRequest,
  type RequestApprovalFn,
} from "./approval.js";
