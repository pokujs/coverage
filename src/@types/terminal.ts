export type ColorName =
  | 'red'
  | 'yellow'
  | 'green'
  | 'gray'
  | 'blue'
  | 'dim'
  | 'dimGray'
  | 'pink'
  | 'purple'
  | 'white';

export type IDE =
  | 'jetbrains'
  | 'cursor'
  | 'windsurf'
  | 'vscode-insiders'
  | 'vscode';

export type UrlBuilder = (
  absolutePath: string,
  lineNumber: number,
  columnNumber: number
) => string;

export type IDEUrlBuilders = Record<IDE, UrlBuilder>;
