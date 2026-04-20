import type { FileAggregation } from '../../@types/v8.js';

const applyIgnoredLines = (
  lineHits: Map<number, number>,
  ignoredLines: Set<number>
): void => {
  for (const ignoredLine of ignoredLines) {
    if (lineHits.has(ignoredLine)) lineHits.set(ignoredLine, 1);
  }
};

const applyIgnoredBranches = (
  fileAggregation: FileAggregation,
  ignoredLines: Set<number>
): void => {
  if (ignoredLines.size === 0) return;

  for (const functionEntry of fileAggregation.functions.values()) {
    if (functionEntry.blocks.length === 0) continue;

    functionEntry.blocks = functionEntry.blocks.filter(
      (block) => !ignoredLines.has(block.line)
    );
  }
};

const merge = (
  target: Map<number, number>,
  source: Map<number, number>
): void => {
  for (const [lineNumber, hits] of source)
    target.set(lineNumber, (target.get(lineNumber) ?? 0) + hits);
};

export const lineHits = {
  applyIgnoredLines,
  applyIgnoredBranches,
  merge,
} as const;
