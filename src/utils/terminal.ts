import type { ColorName, UrlBuilder } from '../@types/terminal.js';
import process from 'node:process';

const OSC_PREFIX = '\x1b]';
const STRING_TERMINATOR = '\x1b\\';
const ANSI_RESET = '\x1b[0m';

const ANSI: Record<ColorName, string> = {
  red: '\x1b[1;91m',
  yellow: '\x1b[1;93m',
  green: '\x1b[0;32m',
  gray: '\x1b[0;90m',
  blue: '\x1b[1;94m',
  dim: '\x1b[2m',
  dimGray: '\x1b[2;90m',
  pink: '\x1b[1;38;5;212m',
  purple: '\x1b[1;38;5;105m',
  white: ANSI_RESET,
};

const isColorEnabled = (): boolean => {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '')
    return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0')
    return true;
  return process.stdout.isTTY === true;
};

const colorize = (text: string, color: ColorName): string => {
  if (!isColorEnabled()) return text;
  return `${ANSI[color]}${text}${ANSI_RESET}`;
};

const hyperlink = (
  text: string,
  absolutePath: string,
  lineNumber: number,
  columnNumber: number,
  urlBuilder: UrlBuilder
): string => {
  const url = urlBuilder(absolutePath, lineNumber, columnNumber);
  return `${OSC_PREFIX}8;;${url}${STRING_TERMINATOR}${text}${OSC_PREFIX}8;;${STRING_TERMINATOR}`;
};

const supportsHyperlinks = (): boolean => {
  if (
    process.env.NO_HYPERLINKS !== undefined &&
    process.env.NO_HYPERLINKS !== ''
  )
    return false;

  if (
    process.env.FORCE_HYPERLINKS !== undefined &&
    process.env.FORCE_HYPERLINKS !== '0'
  )
    return true;

  if (process.stdout.isTTY !== true) return false;
  if (process.env.CI !== undefined && process.env.CI !== '') return false;

  const termProgram = process.env.TERM_PROGRAM;

  if (termProgram === 'Apple_Terminal') return false;
  if (termProgram === 'vscode') return true;
  if (termProgram === 'WezTerm') return true;
  if (termProgram === 'ghostty') return true;
  if (termProgram === 'iTerm.app') {
    const version = process.env.TERM_PROGRAM_VERSION;
    if (version === undefined) return false;

    const [majorString, minorString] = version.split('.');
    const major = Number(majorString);
    const minor = Number(minorString);

    if (Number.isNaN(major) || Number.isNaN(minor)) return false;
    return major > 3 || (major === 3 && minor >= 1);
  }

  if (process.env.TERM === 'xterm-kitty') return true;
  if (process.env.KITTY_WINDOW_ID !== undefined) return true;
  if (process.env.WT_SESSION !== undefined) return true;
  if (process.env.KONSOLE_VERSION !== undefined) return true;
  if (process.env.TERMINUS_SUBLIME !== undefined) return true;
  if (process.env.TERMINUS_PLUGIN_VERSION !== undefined) return true;

  if (process.env.VTE_VERSION !== undefined) {
    const vteVersion = Number(process.env.VTE_VERSION);
    if (!Number.isNaN(vteVersion) && vteVersion >= 5000) return true;
  }

  return false;
};

export const terminal = {
  ANSI,
  isColorEnabled,
  colorize,
  hyperlink,
  supportsHyperlinks,
} as const;
