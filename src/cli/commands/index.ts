import type { Agent } from "@mariozechner/pi-agent-core";
import { SelectList, type SlashCommand, type TUI } from "@mariozechner/pi-tui";
import { getOAuthProviders } from "@mariozechner/pi-ai/oauth";
import type { ChatView } from "../ui/chat.js";
import type { InputView } from "../ui/input.js";
import type { ModelRegistry } from "../../core/config.js";
import type { SessionStore } from "../../core/session-store.js";
import type { OAuthStore } from "../../core/oauth-store.js";
import { SessionStore as SessionStoreClass } from "../../core/session-store.js";
import { selectListTheme } from "../types.js";
import { t, setLocale, getLocale, SUPPORTED_LOCALES } from "../../core/i18n/index.js";
import type { Locale } from "../../core/i18n/index.js";

export interface CommandContext {
  agent: Agent;
  chatView: ChatView;
  inputView: InputView;
  registry: ModelRegistry;
  tui: TUI;
  store: SessionStore;
  oauthStore: OAuthStore;
  getCurrentSessionId: () => string;
  setCurrentSessionId: (id: string) => void;
  getSessionCreatedAt: () => number;
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
                      type: "sub",
                      spawnedBy: "user",
                      title: SessionStoreClass.deriveTitle(currentMessages),
                      createdAt: ctx.getSessionCreatedAt(),
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
  {
    name: "rename",
    description: () => t("cmd.rename"),
    execute: async (args, ctx) => {
      const title = args.trim();
      if (!title) {
        ctx.chatView.appendSystemMessage(t("cmd.rename_usage"));
        return;
      }
      const sessionId = ctx.getCurrentSessionId();
      try {
        await ctx.store.rename(sessionId, title);
        ctx.chatView.appendSystemMessage(`${t("cmd.renamed")}: ${title}`);
      } catch {
        ctx.chatView.appendSystemMessage(t("cmd.rename_failed"));
      }
    },
  },
  {
    name: "locale",
    description: () => t("cmd.locale"),
    execute: (_args, ctx) => {
      const current = getLocale();

      ctx.inputView.showSelector((done) => {
        const items = SUPPORTED_LOCALES.map((loc) => ({
          value: loc,
          label: loc === "en" ? "English" : "中文",
          description: loc === current ? "(current)" : undefined,
        }));

        const list = new SelectList(items, 5, selectListTheme);
        const currentIdx = SUPPORTED_LOCALES.indexOf(current);
        if (currentIdx >= 0) list.setSelectedIndex(currentIdx);

        list.onSelect = (item) => {
          done();
          if (item.value !== current) {
            setLocale(item.value as Locale);
            ctx.chatView.appendSystemMessage(`${t("cmd.locale_switched")}: ${item.label}`);
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
    name: "delete",
    description: () => t("cmd.delete"),
    execute: async (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;

      const summaries = await ctx.store.list();
      // Filter out main agent from deletable sessions
      const deletable = summaries.filter((s) => s.type !== "main");
      if (deletable.length === 0) {
        ctx.chatView.appendSystemMessage(t("cmd.no_history"));
        return;
      }

      ctx.inputView.showSelector((done) => {
        const items = deletable.map((s) => ({
          value: s.id,
          label: s.title,
          description: new Date(s.updatedAt).toLocaleString(),
        }));

        const list = new SelectList(items, 10, selectListTheme);

        list.onSelect = (item) => {
          done();
          // Don't allow deleting current session
          if (item.value === ctx.getCurrentSessionId()) {
            ctx.chatView.appendSystemMessage(t("cmd.delete_current"));
            return;
          }
          ctx.store.delete(item.value).then((ok) => {
            if (ok) {
              ctx.chatView.appendSystemMessage(`${t("cmd.deleted")}: ${item.label}`);
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
  {
    name: "login",
    description: () => t("cmd.login"),
    execute: (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;

      const providers = getOAuthProviders();
      if (providers.length === 0) {
        ctx.chatView.appendSystemMessage(t("cmd.no_oauth_providers"));
        return;
      }

      ctx.inputView.showSelector((done) => {
        const items = providers.map((p) => ({
          value: p.id,
          label: p.name,
          description: p.id,
        }));

        const list = new SelectList(items, 10, selectListTheme);

        list.onSelect = (item) => {
          done();
          const provider = providers.find((p) => p.id === item.value);
          if (!provider) return;

          ctx.chatView.appendSystemMessage(`${t("cmd.login_select")}: ${provider.name}`);

          // Create a promise for prompt resolution
          let promptResolve: ((value: string) => void) | null = null;

          provider
            .login({
              onAuth: (info) => {
                ctx.chatView.appendSystemMessage(info.url);
                if (info.instructions) {
                  ctx.chatView.appendSystemMessage(info.instructions);
                }
              },
              onPrompt: (prompt) => {
                return new Promise<string>((resolve) => {
                  promptResolve = resolve;
                  ctx.chatView.appendSystemMessage(prompt.message);
                  ctx.inputView.onSubmitOnce((text) => {
                    if (promptResolve) {
                      promptResolve(text);
                      promptResolve = null;
                    }
                  });
                });
              },
              onProgress: (msg) => {
                ctx.chatView.appendSystemMessage(msg);
              },
              onManualCodeInput: () => {
                return new Promise<string>((resolve) => {
                  promptResolve = resolve;
                  ctx.inputView.onSubmitOnce((text) => {
                    if (promptResolve) {
                      promptResolve(text);
                      promptResolve = null;
                    }
                  });
                });
              },
            })
            .then(async (creds) => {
              await ctx.oauthStore.save(provider.id, creds);
              ctx.chatView.appendSystemMessage(`${t("cmd.login_success")}: ${provider.name}`);
            })
            .catch((err) => {
              ctx.chatView.appendSystemMessage(
                `${t("cmd.login_failed")}: ${err instanceof Error ? err.message : String(err)}`,
              );
            });
        };

        list.onCancel = () => {
          done();
        };

        return { component: list, focus: list };
      });
    },
  },
  {
    name: "logout",
    description: () => t("cmd.logout"),
    execute: async (_args, ctx) => {
      if (ctx.agent.state.isStreaming) return;

      const allCreds = await ctx.oauthStore.loadAll();
      const authenticatedIds = Object.keys(allCreds);

      if (authenticatedIds.length === 0) {
        ctx.chatView.appendSystemMessage(t("cmd.no_oauth_providers"));
        return;
      }

      const providers = getOAuthProviders();

      ctx.inputView.showSelector((done) => {
        const items = authenticatedIds.map((id) => {
          const provider = providers.find((p) => p.id === id);
          return {
            value: id,
            label: provider?.name ?? id,
            description: id,
          };
        });

        const list = new SelectList(items, 10, selectListTheme);

        list.onSelect = (item) => {
          done();
          ctx.oauthStore.delete(item.value).then((ok) => {
            if (ok) {
              ctx.chatView.appendSystemMessage(`${t("cmd.logout_success")}: ${item.label}`);
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
