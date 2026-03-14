import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const Params = Type.Object({
  path: Type.String({ description: "文件路径（绝对路径或相对路径）" }),
  old_string: Type.Optional(
    Type.String({ description: "要替换的原始字符串，必须在文件中唯一匹配。省略则创建新文件。" }),
  ),
  new_string: Type.String({ description: "新内容。编辑时替换 old_string；创建时为完整文件内容。" }),
});

type Params = Static<typeof Params>;

export const fileWriteTool: AgentTool<typeof Params> = {
  name: "file_write",
  label: "Write File",
  description:
    "创建新文件或编辑已有文件。编辑时使用 old_string→new_string 精确替换（old_string 必须唯一）。创建时省略 old_string，new_string 为完整内容。",
  parameters: Params,
  execute: async (_id, params, signal) => {
    try {
      if (signal?.aborted) {
        return {
          content: [{ type: "text" as const, text: "Aborted" }],
          details: {},
        };
      }

      const { path, old_string, new_string } = params;

      // --- Edit mode: old_string → new_string ---
      if (old_string !== undefined) {
        let content: string;
        try {
          content = await readFile(path, "utf-8");
        } catch (err: any) {
          if (err.code === "ENOENT") {
            return {
              content: [{ type: "text" as const, text: `Error: File not found: ${path}` }],
              details: {},
            };
          }
          throw err;
        }

        const first = content.indexOf(old_string);
        if (first === -1) {
          return {
            content: [{ type: "text" as const, text: `Error: old_string not found in ${path}` }],
            details: {},
          };
        }

        const last = content.lastIndexOf(old_string);
        if (first !== last) {
          return {
            content: [{ type: "text" as const, text: `Error: old_string has multiple matches in ${path}. Provide more context to make it unique.` }],
            details: {},
          };
        }

        const newContent = content.slice(0, first) + new_string + content.slice(first + old_string.length);
        await writeFile(path, newContent, "utf-8");

        return {
          content: [{ type: "text" as const, text: `Edited ${path}` }],
          details: { path, mode: "edit" },
        };
      }

      // --- Create mode: write full content ---
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, new_string, "utf-8");

      return {
        content: [{ type: "text" as const, text: `Created ${path} (${new_string.length} chars)` }],
        details: { path, mode: "create", chars: new_string.length },
      };
    } catch (err: any) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err.message}` }],
        details: {},
      };
    }
  },
};
