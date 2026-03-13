import type { MarkdownTheme, SelectListTheme, EditorTheme } from "@mariozechner/pi-tui";

// ANSI helpers
const bold = (t: string) => `\x1b[1m${t}\x1b[22m`;
const italic = (t: string) => `\x1b[3m${t}\x1b[23m`;
const dim = (t: string) => `\x1b[2m${t}\x1b[22m`;
const cyan = (t: string) => `\x1b[36m${t}\x1b[39m`;
const green = (t: string) => `\x1b[32m${t}\x1b[39m`;
const yellow = (t: string) => `\x1b[33m${t}\x1b[39m`;
const gray = (t: string) => `\x1b[90m${t}\x1b[39m`;
const magenta = (t: string) => `\x1b[35m${t}\x1b[39m`;
const strikethrough = (t: string) => `\x1b[9m${t}\x1b[29m`;
const underline = (t: string) => `\x1b[4m${t}\x1b[24m`;
const bgGray = (t: string) => `\x1b[48;5;236m${t}\x1b[49m`;

export const markdownTheme: MarkdownTheme = {
  heading: (t) => bold(cyan(t)),
  link: (t) => underline(cyan(t)),
  linkUrl: (t) => dim(t),
  code: (t) => bgGray(yellow(t)),
  codeBlock: (t) => t,
  codeBlockBorder: (t) => dim(t),
  quote: (t) => italic(t),
  quoteBorder: (t) => dim(t),
  hr: (t) => dim(t),
  listBullet: (t) => cyan(t),
  bold: (t) => bold(t),
  italic: (t) => italic(t),
  strikethrough: (t) => strikethrough(t),
  underline: (t) => underline(t),
};

export const selectListTheme: SelectListTheme = {
  selectedPrefix: (t) => cyan(t),
  selectedText: (t) => bold(t),
  description: (t) => dim(t),
  scrollInfo: (t) => dim(t),
  noMatch: (t) => dim(t),
};

export const editorTheme: EditorTheme = {
  borderColor: (t) => cyan(t),
  selectList: selectListTheme,
};

export const colors = { bold, italic, dim, cyan, green, yellow, gray, magenta, underline };
