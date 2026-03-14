import { ProcessTerminal, TUI, matchesKey, Key, SelectList } from "@mariozechner/pi-tui";
import { loadConfig, initModelRegistry } from "../core/config.js";
import { tools, createShellExecTool, createApprovalGate } from "../core/tools/index.js";
import type { ApprovalDecision } from "../core/tools/index.js";
import { SessionStore } from "../core/session-store.js";
import { OAuthStore } from "../core/oauth-store.js";
import { setLocale, t } from "../core/i18n/index.js";
import { handleCommand, getSlashCommands } from "./commands/index.js";
import type { CommandContext } from "./commands/index.js";
import { selectListTheme } from "./types.js";
import { createApp } from "./ui/app.js";
import { createCliAgent } from "./agent.js";
import { v4 as uuidv4 } from "uuid";
import { resolve } from "node:path";

const config = loadConfig();
const registry = await initModelRegistry(config);

// Initialize locale
setLocale(config.locale ?? "en");

// Initialize session store
const store = new SessionStore(config.sessionsDir);
await store.init();

// Initialize OAuth store (same directory as config.json)
const configDir = resolve(process.cwd());
const oauthStore = new OAuthStore(configDir);
await oauthStore.init();

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

let currentSessionId = uuidv4();
let sessionCreatedAt = Date.now();

function shutdown(): void {
  tui.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const slashCommands = getSlashCommands();
const { chatView, inputView } = createApp(tui, slashCommands);

// --- Approval gate for shell_exec ---
const approvalGate = createApprovalGate();
approvalGate.requestApproval = async (req) => {
  return new Promise<ApprovalDecision>((resolve) => {
    chatView.showApprovalRequest(req.command);

    inputView.showSelector((done) => {
      const items = [
        { value: "allow", label: t("approval.allow"), description: t("approval.allow_once") },
        { value: "always", label: t("approval.always"), description: t("approval.always_desc") },
        { value: "deny", label: t("approval.deny") },
      ];

      const list = new SelectList(items, 5, selectListTheme);

      list.onSelect = (item) => {
        done();
        resolve(item.value as ApprovalDecision);
      };

      list.onCancel = () => {
        done();
        resolve("deny");
      };

      return { component: list, focus: list };
    });
  });
};

const shellExecTool = createShellExecTool(approvalGate);
const allTools = [...tools, shellExecTool];

const agent = createCliAgent(config, registry, allTools, chatView, inputView, tui, oauthStore);

// Auto-save on agent_end
agent.subscribe((event) => {
  if (event.type === "agent_end") {
    const messages = agent.state.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));
    store
      .save({
        id: currentSessionId,
        type: "sub",
        spawnedBy: "user",
        title: SessionStore.deriveTitle(messages),
        createdAt: sessionCreatedAt,
        updatedAt: Date.now(),
        modelId: agent.state.model.id,
        messages,
      })
      .catch(() => {});
  }
});

const cmdCtx: CommandContext = {
  agent,
  chatView,
  inputView,
  registry,
  tui,
  store,
  oauthStore,
  getCurrentSessionId: () => currentSessionId,
  setCurrentSessionId: (id: string) => {
    currentSessionId = id;
    sessionCreatedAt = Date.now();
  },
  getSessionCreatedAt: () => sessionCreatedAt,
};

inputView.onSubmit(async (text) => {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (handleCommand(trimmed, cmdCtx)) return;

  chatView.appendUserMessage(trimmed);
  inputView.disable();
  try {
    await agent.prompt(trimmed);
  } catch (err) {
    chatView.showError(err instanceof Error ? err.message : String(err));
    inputView.enable();
    inputView.focus(tui);
  }
});

tui.addInputListener((data) => {
  if (matchesKey(data, Key.ctrl("c"))) {
    if (agent.state.isStreaming) {
      agent.abort();
      inputView.enable();
      inputView.focus(tui);
      return { consume: true };
    } else {
      shutdown();
    }
  }
  return undefined;
});

tui.start();
