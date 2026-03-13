import { Container, Markdown, Text, Loader, Spacer } from "@mariozechner/pi-tui";
import type { TUI, Component } from "@mariozechner/pi-tui";
import { markdownTheme, colors } from "../types.js";

export class ChatView {
  readonly container = new Container();
  private tui: TUI;
  private activeLoaders = new Map<string, { loader: Loader; wrapper: Container }>();
  private currentAssistantMd: Markdown | null = null;
  private currentAssistantText = "";

  constructor(tui: TUI) {
    this.tui = tui;
  }

  appendUserMessage(text: string): void {
    const label = new Text(colors.bold(colors.green("You")), 1, 0);
    const body = new Markdown(text, 2, 0, markdownTheme);
    const spacer = new Spacer(1);
    this.container.addChild(label);
    this.container.addChild(body);
    this.container.addChild(spacer);
    this.tui.requestRender();
  }

  startAssistantMessage(): void {
    const label = new Text(colors.bold(colors.cyan("Assistant")), 1, 0);
    this.container.addChild(label);

    this.currentAssistantText = "";
    this.currentAssistantMd = new Markdown("", 2, 0, markdownTheme);
    this.container.addChild(this.currentAssistantMd);
    this.tui.requestRender();
  }

  appendAssistantText(delta: string): void {
    if (!this.currentAssistantMd) return;
    this.currentAssistantText += delta;
    this.currentAssistantMd.setText(this.currentAssistantText);
    this.tui.requestRender();
  }

  endAssistantMessage(): void {
    if (this.currentAssistantMd) {
      const spacer = new Spacer(1);
      this.container.addChild(spacer);
    }
    this.currentAssistantMd = null;
    this.currentAssistantText = "";
    this.tui.requestRender();
  }

  showToolStart(toolCallId: string, toolName: string): void {
    const wrapper = new Container();
    const loader = new Loader(this.tui, colors.cyan, colors.dim, `Running ${toolName}...`);
    wrapper.addChild(loader);
    this.container.addChild(wrapper);
    this.activeLoaders.set(toolCallId, { loader, wrapper });
    this.tui.requestRender();
  }

  showToolEnd(toolCallId: string, toolName: string, isError: boolean): void {
    const entry = this.activeLoaders.get(toolCallId);
    if (entry) {
      entry.loader.stop();
      this.container.removeChild(entry.wrapper);
      this.activeLoaders.delete(toolCallId);
    }

    const status = isError ? colors.yellow("error") : colors.green("done");
    const summary = new Text(`${colors.dim("tool")} ${colors.bold(toolName)} ${status}`, 2, 0);
    this.container.addChild(summary);
    this.tui.requestRender();
  }

  showError(message: string): void {
    const errorText = new Text(colors.yellow(`Error: ${message}`), 1, 0);
    const spacer = new Spacer(1);
    this.container.addChild(errorText);
    this.container.addChild(spacer);
    this.tui.requestRender();
  }

  appendSystemMessage(text: string): void {
    const msg = new Text(colors.dim(text), 1, 0);
    const spacer = new Spacer(1);
    this.container.addChild(msg);
    this.container.addChild(spacer);
    this.tui.requestRender();
  }

  clear(): void {
    for (const { loader } of this.activeLoaders.values()) {
      loader.stop();
    }
    this.activeLoaders.clear();
    this.currentAssistantMd = null;
    this.currentAssistantText = "";
    this.container.clear();
    this.tui.requestRender();
  }
}
