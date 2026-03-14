import { readFile, stat } from "node:fs/promises";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const Params = Type.Object({
  path: Type.String({ description: "要读取的文件路径（绝对路径或相对路径）" }),
  offset: Type.Optional(
    Type.Number({ description: "起始行号（从1开始），默认 1" }),
  ),
  limit: Type.Optional(
    Type.Number({ description: "读取的行数，默认 200" }),
  ),
});

type Params = Static<typeof Params>;

export const fileReadTool: AgentTool<typeof Params> = {
  name: "file_read",
  label: "Read File",
  description:
    "读取文件内容，返回带行号的文本。可指定起始行和行数。",
  parameters: Params,
  execute: async (_id, params) => {
    try {
      const info = await stat(params.path);
      if (!info.isFile()) {
        return {
          content: [{ type: "text" as const, text: `Error: ${params.path} is not a file` }],
          details: {},
        };
      }

      const raw = await readFile(params.path, "utf-8");
      const lines = raw.split("\n");

      const offset = Math.max(1, params.offset ?? 1);
      const limit = Math.max(1, params.limit ?? 200);
      const start = offset - 1; // 0-indexed
      const sliced = lines.slice(start, start + limit);

      const numbered = sliced
        .map((line, i) => `${String(start + i + 1).padStart(6)} │ ${line}`)
        .join("\n");

      const header = `${params.path} (lines ${offset}–${offset + sliced.length - 1} of ${lines.length})`;

      return {
        content: [{ type: "text" as const, text: `${header}\n${numbered}` }],
        details: {
          path: params.path,
          totalLines: lines.length,
          offset,
          returned: sliced.length,
        },
      };
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return {
          content: [{ type: "text" as const, text: `Error: File not found: ${params.path}` }],
          details: {},
        };
      }
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        details: {},
      };
    }
  },
};
