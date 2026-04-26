import type { BranchArmPosition } from '../../@types/branch-discovery.js';
import type {
  TruncatedUncovered,
  UncoveredEntry,
  UncoveredRange,
} from '../../@types/text.js';

const UNCOVERED_DISPLAY_BUDGET = 10;
const SINGLE_LINE_COST = 1;
const LINE_WITH_COLUMNS_COST = 2;
const MULTI_LINE_WITH_COLUMNS_COST = 3;

export const TRUNCATION_SUFFIX = '...';

const costForEntry = (entry: UncoveredEntry): number => {
  if (entry.kind === 'range') {
    return entry.range.start === entry.range.end
      ? SINGLE_LINE_COST
      : LINE_WITH_COLUMNS_COST;
  }

  return entry.position.line === entry.position.endLine
    ? LINE_WITH_COLUMNS_COST
    : MULTI_LINE_WITH_COLUMNS_COST;
};

export const truncateUncovered = (
  entries: UncoveredEntry[]
): TruncatedUncovered => {
  const visible: UncoveredEntry[] = [];

  let remaining = UNCOVERED_DISPLAY_BUDGET;

  for (const entry of entries) {
    const cost = costForEntry(entry);
    if (cost > remaining) return { visible, truncated: true };

    visible.push(entry);
    remaining -= cost;
  }

  return { visible, truncated: false };
};

export const extractUncoveredLines = (
  lineHits: Map<number, number>
): number[] => {
  const uncovered: number[] = [];

  for (const [lineNumber, hits] of lineHits)
    if (hits === 0) uncovered.push(lineNumber);

  return uncovered.sort((left, right) => left - right);
};

export const collapseRanges = (lines: number[]): UncoveredRange[] => {
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((left, right) => left - right);
  const ranges: UncoveredRange[] = [];

  let start = sorted[0];
  let previous = start;

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];

    if (current === previous + 1) {
      previous = current;
      continue;
    }

    ranges.push({ start, end: previous });

    start = current;
    previous = current;
  }

  ranges.push({ start, end: previous });
  return ranges;
};

export const formatRange = (range: UncoveredRange): string =>
  range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`;

export const formatArmPosition = (position: BranchArmPosition): string => {
  const startColumn = position.column + 1;
  const endColumn = position.endColumn + 1;

  if (position.endLine === position.line)
    return `${position.line}:${startColumn}-${endColumn}`;
  return `${position.line}:${startColumn}-${position.endLine}:${endColumn}`;
};

export const formatUncoveredEntry = (entry: UncoveredEntry): string => {
  if (entry.kind === 'range') return formatRange(entry.range);
  return formatArmPosition(entry.position);
};
