import type { Agent } from "@mariozechner/pi-agent-core";
import { SelectList, type SlashCommand, type TUI } from "@mariozechner/pi-tui";
import type { ChatView } from "../ui/chat.js";
import type { ModelRegistry } from "../config.js";
import { selectListTheme } from "../types.js";

export interface CommandContext {
  agent: Agent;
  chatView: ChatView;
  registry: ModelRegistry;
  tui: TUI;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => void;
}

const commands: Command[] = [
  {
    name: "exit",
    description: "Exit the application",
    execute: () => {
      process.emit("SIGTERM");
    },
  },
  {
    name: "clear",
    description: "Clear the conversation",
    execute: (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;
      ctx.agent.clearMessages();
      ctx.chatView.clear();
    },
  },
  {
    name: "model",
    description: "Show or switch model (/model [name])",
    execute: (args, ctx) => {
      if (args) {
        const target = args.trim();
        if (!ctx.registry.availableModels.includes(target)) {
          ctx.chatView.appendSystemMessage(`Unknown model: ${target}`);
          return;
        }
        const model = ctx.registry.resolve(target);
        ctx.agent.setModel(model);
        ctx.chatView.appendSystemMessage(`Switched to ${target}`);
        return;
      }

      // No args — show interactive model selector (deferred to escape editor's input chain)
      const current = ctx.agent.state.model.id;
      queueMicrotask(() => {
        const items = ctx.registry.availableModels.map((id) => ({
          value: id,
          label: id,
          description: id === current ? "(current)" : undefined,
        }));

        const list = new SelectList(items, 10, selectListTheme);

        const currentIdx = ctx.registry.availableModels.indexOf(current);
        if (currentIdx >= 0) list.setSelectedIndex(currentIdx);

        const handle = ctx.tui.showOverlay(list, {
          width: "50%",
          anchor: "bottom-left",
        });

        list.onSelect = (item) => {
          handle.hide();
          if (item.value !== current) {
            const model = ctx.registry.resolve(item.value);
            ctx.agent.setModel(model);
            ctx.chatView.appendSystemMessage(`Switched to ${item.value}`);
          }
        };

        list.onCancel = () => {
          handle.hide();
        };
      });
    },
  },
];

const commandMap = new Map(commands.map((c) => [c.name, c]));

export function handleCommand(input: string, ctx: CommandContext): boolean {
  if (!input.startsWith("/")) return false;

  const parts = input.slice(1).split(/\s+/);
  const name = parts[0];
  const args = parts.slice(1).join(" ");

  const command = commandMap.get(name);
  if (!command) {
    ctx.chatView.appendSystemMessage(`Unknown command: /${name}`);
    return true;
  }

  command.execute(args, ctx);
  return true;
}

export function getSlashCommands(): SlashCommand[] {
  return commands.map((c) => ({
    name: c.name,
    description: c.description,
  }));
}
