import { Editor, CombinedAutocompleteProvider } from "@mariozechner/pi-tui";
import type { TUI, SlashCommand } from "@mariozechner/pi-tui";
import { editorTheme } from "../types.js";

export class InputView {
  readonly editor: Editor;

  constructor(tui: TUI, slashCommands: SlashCommand[]) {
    const editor = new Editor(tui, editorTheme, { paddingX: 1 });
    const autocomplete = new CombinedAutocompleteProvider(slashCommands);
    editor.setAutocompleteProvider(autocomplete);
    this.editor = editor;
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
    this.editor.onSubmit = (text: string) => {
      this.editor.addToHistory(text);
      this.editor.setText("");
      handler(text);
    };
  }
}
