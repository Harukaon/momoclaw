import { spawn } from "node:child_process";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  type ApprovalGate,
  checkApproval,
  ApprovalDeniedError,
} from "./approval.js";

const MAX_OUTPUT = 100 * 1024; // 100KB
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;

const Params = Type.Object({
  command: Type.String({ description: "要执行的 shell 命令" }),
  timeout: Type.Optional(
    Type.Number({ description: "超时毫秒数，默认 30000，最大 120000" }),
  ),
  cwd: Type.Optional(
    Type.String({ description: "工作目录" }),
  ),
});

type Params = Static<typeof Params>;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n... (truncated at ${max} bytes)`;
}

export function createShellExecTool(gate?: ApprovalGate): AgentTool<typeof Params> {
  return {
    name: "shell_exec",
    label: "Shell Execute",
    description:
      "执行 shell 命令并返回结果。某些命令可能需要用户审批。",
    parameters: Params,
    execute: async (toolCallId, params, signal) => {
      // --- Approval gate ---
      if (gate) {
        try {
          await checkApproval(
            gate,
            { toolCallId, toolName: "shell_exec", command: params.command },
            signal,
          );
        } catch (err) {
          if (err instanceof ApprovalDeniedError) {
            return {
              content: [{ type: "text" as const, text: `Error: ${err.message}` }],
              details: { denied: true },
            };
          }
          throw err;
        }
      }

      if (signal?.aborted) {
        return {
          content: [{ type: "text" as const, text: "Aborted" }],
          details: {},
        };
      }

      // --- Execute ---
      const timeout = Math.min(
        Math.max(1000, params.timeout ?? DEFAULT_TIMEOUT),
        MAX_TIMEOUT,
      );

      return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        let killed = false;

        const isWindows = process.platform === "win32";
        const shell = isWindows ? "cmd.exe" : "/bin/sh";
        const shellArgs = isWindows ? ["/c", params.command] : ["-c", params.command];

        const child = spawn(shell, shellArgs, {
          cwd: params.cwd || process.cwd(),
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });

        const timer = setTimeout(() => {
          killed = true;
          child.kill("SIGKILL");
        }, timeout);

        // Abort signal
        if (signal) {
          const onAbort = () => {
            killed = true;
            child.kill("SIGKILL");
          };
          signal.addEventListener("abort", onAbort, { once: true });
          child.on("exit", () => signal.removeEventListener("abort", onAbort));
        }

        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on("error", (err) => {
          clearTimeout(timer);
          resolve({
            content: [{ type: "text" as const, text: `Error: ${err.message}` }],
            details: { exitCode: -1 },
          });
        });

        child.on("exit", (code) => {
          clearTimeout(timer);

          const parts: string[] = [];
          if (stdout) parts.push(truncate(stdout, MAX_OUTPUT));
          if (stderr) parts.push(`[stderr]\n${truncate(stderr, MAX_OUTPUT)}`);
          if (killed) parts.push("[process killed: timeout or abort]");

          const text = parts.length > 0 ? parts.join("\n") : "(no output)";

          resolve({
            content: [{ type: "text" as const, text: `Exit code: ${code ?? -1}\n${text}` }],
            details: { exitCode: code ?? -1, killed },
          });
        });
      });
    },
  };
}
