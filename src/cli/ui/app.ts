import { Spacer, Text } from "@mariozechner/pi-tui";
import type { TUI, SlashCommand } from "@mariozechner/pi-tui";
import { ChatView } from "./chat.js";
import { InputView } from "./input.js";
import { colors } from "../types.js";

export interface AppUI {
  chatView: ChatView;
  inputView: InputView;
}

export function createApp(tui: TUI, slashCommands: SlashCommand[]): AppUI {
  const header = new Text(colors.bold(colors.cyan(" my-assistant")), 0, 0);
  const headerSpacer = new Spacer(1);

  const chatView = new ChatView(tui);
  const inputView = new InputView(tui, slashCommands);

  tui.children = [header, headerSpacer, chatView.container, inputView.container];
  tui.setFocus(inputView.editor);

  return { chatView, inputView };
}
