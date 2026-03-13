import type { Agent } from "@mariozechner/pi-agent-core";
import { SelectList, type SlashCommand, type TUI } from "@mariozechner/pi-tui";
import type { ChatView } from "../ui/chat.js";
import type { InputView } from "../ui/input.js";
import type { ModelRegistry } from "../../core/config.js";
import type { SessionStore } from "../../core/session-store.js";
import { SessionStore as SessionStoreClass } from "../../core/session-store.js";
import { selectListTheme } from "../types.js";
import { t } from "../../core/i18n/index.js";

export interface CommandContext {
  agent: Agent;
  chatView: ChatView;
  inputView: InputView;
  registry: ModelRegistry;
  tui: TUI;
  store: SessionStore;
  getCurrentSessionId: () => string;
  setCurrentSessionId: (id: string) => void;
}

export interface Command {
  name: string;
  description: () => string;
  execute: (args: string, ctx: CommandContext) => void;
}

const commands: Command[] = [
  {
    name: "exit",
    description: () => t("cmd.exit"),
    execute: () => {
      process.emit("SIGTERM");
    },
  },
  {
    name: "clear",
    description: () => t("cmd.clear"),
    execute: (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;
      ctx.agent.clearMessages();
      ctx.chatView.clear();
    },
  },
  {
    name: "model",
    description: () => t("cmd.model"),
    execute: (args, ctx) => {
      if (args) {
        const target = args.trim();
        if (!ctx.registry.availableModels.includes(target)) {
          ctx.chatView.appendSystemMessage(`${t("cmd.unknown_model")}: ${target}`);
          return;
        }
        const model = ctx.registry.resolve(target);
        ctx.agent.setModel(model);
        ctx.chatView.appendSystemMessage(`${t("cmd.switched_to")} ${target}`);
        return;
      }

      const current = ctx.agent.state.model.id;

      ctx.inputView.showSelector((done) => {
        const items = ctx.registry.availableModels.map((id) => ({
          value: id,
          label: id,
          description: id === current ? "(current)" : undefined,
        }));

        const list = new SelectList(items, 10, selectListTheme);

        const currentIdx = ctx.registry.availableModels.indexOf(current);
        if (currentIdx >= 0) list.setSelectedIndex(currentIdx);

        list.onSelect = (item) => {
          done();
          if (item.value !== current) {
            const model = ctx.registry.resolve(item.value);
            ctx.agent.setModel(model);
            ctx.chatView.appendSystemMessage(`${t("cmd.switched_to")} ${item.value}`);
          }
        };

        list.onCancel = () => {
          done();
        };

        return { component: list, focus: list };
      });
    },
  },
  {
    name: "history",
    description: () => t("cmd.history"),
    execute: async (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;

      const summaries = await ctx.store.list();

      if (summaries.length === 0) {
        ctx.chatView.appendSystemMessage(t("cmd.no_history"));
        return;
      }

      ctx.inputView.showSelector((done) => {
        const items = summaries.map((s) => ({
          value: s.id,
          label: s.title,
          description: new Date(s.updatedAt).toLocaleString(),
        }));

        const list = new SelectList(items, 10, selectListTheme);

        list.onSelect = (item) => {
          done();
          ctx.store.load(item.value).then((persisted) => {
            if (persisted) {
              // Save current session first
              const currentMessages = ctx.agent.state.messages.map((m: any) => ({
                role: m.role,
                content: m.content,
              }));
              const savePromise =
                currentMessages.length > 0
                  ? ctx.store.save({
                      id: ctx.getCurrentSessionId(),
                      title: SessionStoreClass.deriveTitle(currentMessages),
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      modelId: ctx.agent.state.model.id,
                      messages: currentMessages,
                    })
                  : Promise.resolve();

              savePromise.then(() => {
                ctx.agent.replaceMessages(persisted.messages as any);
                ctx.setCurrentSessionId(persisted.id);
                ctx.chatView.clear();
                ctx.chatView.appendSystemMessage(`${t("cmd.session_loaded")}: ${persisted.title}`);
              });
            }
          });
        };

        list.onCancel = () => {
          done();
        };

        return { component: list, focus: list };
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
    ctx.chatView.appendSystemMessage(`${t("cmd.unknown")}: /${name}`);
    return true;
  }

  command.execute(args, ctx);
  return true;
}

export function getSlashCommands(): SlashCommand[] {
  return commands.map((c) => ({
    name: c.name,
    description: c.description(),
  }));
}
