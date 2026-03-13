import { ProcessTerminal, TUI, matchesKey, Key } from "@mariozechner/pi-tui";
import { loadConfig, initModelRegistry } from "./config.js";
import { tools } from "./tools/index.js";
import { handleCommand, getSlashCommands } from "./commands/index.js";
import type { CommandContext } from "./commands/index.js";
import { createApp } from "./ui/app.js";
import { createAgent } from "./agent.js";

const config = loadConfig();
const registry = await initModelRegistry(config);

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

function shutdown(): void {
  tui.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const slashCommands = getSlashCommands();
const { chatView, inputView } = createApp(tui, slashCommands);
const agent = createAgent(config, registry, tools, chatView, inputView, tui);

const cmdCtx: CommandContext = { agent, chatView, registry, tui };

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
