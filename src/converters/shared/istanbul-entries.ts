/*
 * Adapted from v8-to-istanbul's `branch.js`, `function.js`, `line.js`, `source.js`.
 * Original: https://github.com/istanbuljs/v8-to-istanbul
 * Copyright 2017, Contributors
 * ISC License
 */

import type {
  BranchMapEntry,
  CovBranch,
  CovFunction,
  CovLine,
  CovSource,
  FnMapEntry,
  StatementMapEntry,
} from '../../@types/istanbul.js';
import { ignoreDirectives, LINE_SPLIT } from './ignore-directives.js';

const NEWLINE_PATTERN = /\r?\n$/u;

const createCovBranch = (
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  count: number
): CovBranch => ({
  startLine,
  startColumn,
  endLine,
  endColumn,
  count,
});

const covBranchToBranchMapEntry = (covBranch: CovBranch): BranchMapEntry => {
  const location = {
    start: { line: covBranch.startLine, column: covBranch.startColumn },
    end: { line: covBranch.endLine, column: covBranch.endColumn },
  };

  return {
    type: 'branch',
    line: covBranch.startLine,
    loc: location,
    locations: [{ ...location }],
  };
};

const createCovFunction = (
  name: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
  count: number
): CovFunction => ({
  name,
  startLine,
  startColumn,
  endLine,
  endColumn,
  count,
});

const covFunctionToFnMapEntry = (covFunction: CovFunction): FnMapEntry => {
  const declaration = {
    start: { line: covFunction.startLine, column: covFunction.startColumn },
    end: { line: covFunction.endLine, column: covFunction.endColumn },
  };

  return {
    name: covFunction.name,
    decl: declaration,
    loc: { ...declaration },
    line: covFunction.startLine,
  };
};

const createCovLine = (
  lineNumber: number,
  startColumn: number,
  lineText: string
): CovLine => {
  const newlineMatch = lineText.match(NEWLINE_PATTERN);
  const newlineLength = newlineMatch ? newlineMatch[0].length : 0;

  return {
    line: lineNumber,
    startColumn,
    endColumn: startColumn + lineText.length - newlineLength,
    count: 1,
    ignore: false,
  };
};

const covLineToStatementMapEntry = (covLine: CovLine): StatementMapEntry => ({
  start: { line: covLine.line, column: 0 },
  end: {
    line: covLine.line,
    column: covLine.endColumn - covLine.startColumn,
  },
});

const buildLines = (source: string): CovLine[] => {
  const ignoredLines = ignoreDirectives.parseSource(source);
  const lines: CovLine[] = [];
  const splitLines = source.split(LINE_SPLIT);

  let runningPosition = 0;

  for (let lineIndex = 0; lineIndex < splitLines.length; lineIndex++) {
    const lineText = splitLines[lineIndex];
    const covLine = createCovLine(lineIndex + 1, runningPosition, lineText);

    covLine.ignore = ignoredLines.has(lineIndex + 1);
    lines.push(covLine);

    runningPosition += lineText.length;
  }

  return lines;
};

const createCovSource = (
  rawSource: string,
  wrapperLength: number
): CovSource => {
  const trimmed = rawSource.length > 0 ? rawSource.trimEnd() : '';

  return {
    lines: buildLines(trimmed),
    eof: trimmed.length,
    shebangLength: 0,
    wrapperLength,
  };
};

export const istanbulEntries = {
  createCovBranch,
  covBranchToBranchMapEntry,
  createCovFunction,
  covFunctionToFnMapEntry,
  createCovLine,
  covLineToStatementMapEntry,
  createCovSource,
} as const;
