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
  if (fileAggregation.blocks.length === 0) return;

  fileAggregation.blocks = fileAggregation.blocks.filter(
    (block) => !ignoredLines.has(block.line)
  );
};

const promoteFromBranches = (fileAggregation: FileAggregation): void => {
  if (fileAggregation.blocks.length === 0) return;

  for (const block of fileAggregation.blocks) {
    for (const arm of block.arms) {
      if (arm.takenCount <= 0) continue;

      const existing = fileAggregation.lineHits.get(arm.line);
      if (existing !== undefined && existing > 0) continue;

      fileAggregation.lineHits.set(arm.line, arm.takenCount);
    }
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
  promoteFromBranches,
  merge,
} as const;
