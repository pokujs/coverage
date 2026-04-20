/*
 * Adapted from v8-to-istanbul's `source.js` (ignore-directive state machine).
 * Original: https://github.com/istanbuljs/v8-to-istanbul
 * Copyright 2017, Contributors
 * ISC License
 */

import type { IgnoreDirective } from '../../@types/ignore-directives.js';

const IGNORE_NEXT_ALONE = /^\W*\/\* (v8|jsc) ignore next/;
const IGNORE_NEXT_INLINE = /\/\* (v8|jsc) ignore next/;
const IGNORE_START_STOP = /\/\* (v8|jsc) ignore (?<mode>start|stop)/;
const IGNORE_NEXT_COUNT = /^\W*\/\* (v8|jsc) ignore next (?<count>[0-9]+)/;
export const LINE_SPLIT = /(?<=\r?\n)/u;

const parseIgnoreDirective = (
  lineText: string
): IgnoreDirective | undefined => {
  const countMatch = lineText.match(IGNORE_NEXT_COUNT);
  if (countMatch?.groups) return { count: Number(countMatch.groups.count) };

  if (lineText.match(IGNORE_NEXT_ALONE)) return { count: 1 };
  if (lineText.match(IGNORE_NEXT_INLINE)) return { count: 0 };

  const startStopMatch = lineText.match(IGNORE_START_STOP);

  if (startStopMatch?.groups) {
    if (startStopMatch.groups.mode === 'start') return { start: true };
    if (startStopMatch.groups.mode === 'stop') return { stop: true };
  }

  return undefined;
};

const parseSource = (source: string): Set<number> => {
  const ignoredLines = new Set<number>();
  const splitLines = source.split(LINE_SPLIT);

  let remainingIgnoreCount = 0;
  let ignoreAllActive = false;

  for (let lineIndex = 0; lineIndex < splitLines.length; lineIndex++) {
    const lineText = splitLines[lineIndex];
    const lineNumber = lineIndex + 1;

    if (remainingIgnoreCount > 0) {
      ignoredLines.add(lineNumber);
      remainingIgnoreCount--;
    } else if (ignoreAllActive) {
      ignoredLines.add(lineNumber);
    }

    const directive = parseIgnoreDirective(lineText);
    if (!directive) continue;

    ignoredLines.add(lineNumber);

    if (directive.count !== undefined) {
      remainingIgnoreCount = directive.count;
    }

    if (directive.start || directive.stop) {
      ignoreAllActive = directive.start ?? false;
      remainingIgnoreCount = 0;
    }
  }

  return ignoredLines;
};

export const ignoreDirectives = {
  parseSource,
} as const;
