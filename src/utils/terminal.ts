import type { UrlBuilder } from '../@types/ide.js';
import process from 'node:process';

const OSC_PREFIX = '\x1b]';
const STRING_TERMINATOR = '\x1b\\';

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

export const terminal = { hyperlink, supportsHyperlinks } as const;
