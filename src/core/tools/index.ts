import type { AgentTool } from "@mariozechner/pi-agent-core";
import { fileReadTool } from "./file-read.js";
import { fileWriteTool } from "./file-write.js";

export const tools: AgentTool<any>[] = [
  fileReadTool,
  fileWriteTool,
];

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
