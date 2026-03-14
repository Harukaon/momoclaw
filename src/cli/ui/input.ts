import { Container, Editor, CombinedAutocompleteProvider } from "@mariozechner/pi-tui";
import type { TUI, SlashCommand, Component } from "@mariozechner/pi-tui";
import { editorTheme } from "../types.js";

export class InputView {
  readonly editor: Editor;
  readonly container: Container;
  private tui: TUI;
  private mainSubmitHandler: ((text: string) => void) | null = null;

  constructor(tui: TUI, slashCommands: SlashCommand[]) {
    this.tui = tui;
    const editor = new Editor(tui, editorTheme, { paddingX: 1 });
    const autocomplete = new CombinedAutocompleteProvider(slashCommands);
    editor.setAutocompleteProvider(autocomplete);
    this.editor = editor;

    this.container = new Container();
    this.container.addChild(this.editor);
  }

  focus(tui: TUI): void {
    tui.setFocus(this.editor);
  }

  disable(): void {
    this.editor.disableSubmit = true;
  }

  enable(): void {
    this.editor.disableSubmit = false;
  }

  onSubmit(handler: (text: string) => void): void {
    this.mainSubmitHandler = handler;
    this.editor.onSubmit = (text: string) => {
      this.editor.addToHistory(text);
      this.editor.setText("");
      handler(text);
    };
  }

  /** Temporarily override the submit handler for a single input, then restore the main handler. */
  onSubmitOnce(handler: (text: string) => void): void {
    this.editor.onSubmit = (text: string) => {
      this.editor.addToHistory(text);
      this.editor.setText("");
      handler(text);
      // Restore main handler
      if (this.mainSubmitHandler) {
        this.onSubmit(this.mainSubmitHandler);
      }
    };
  }

  showSelector(create: (done: () => void) => { component: Component; focus: Component }): void {
    const done = () => {
      this.container.clear();
      this.container.addChild(this.editor);
      this.tui.setFocus(this.editor);
      this.tui.requestRender();
    };
    const { component, focus } = create(done);
    this.container.clear();
    this.container.addChild(component);
    this.tui.setFocus(focus);
    this.tui.requestRender();
  }
}
