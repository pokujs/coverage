import type {
  CoverageSnapshot,
  FileSnapshot,
  MetricDetail,
} from '../../../../src/@types/tests.ts';

const buildMetricDetail = (total: number, covered: number): MetricDetail => {
  const missed = total - covered;
  const pct = total === 0 ? 100 : (covered / total) * 100;

  return {
    total,
    covered,
    missed,
    pct: `${pct.toFixed(2)} %`,
  };
};

const compressRanges = (lineNumbers: readonly number[]): string => {
  if (lineNumbers.length === 0) return '';

  const parts: string[] = [];
  let rangeStart = lineNumbers[0];
  let previousLine = lineNumbers[0];

  const flush = () => {
    parts.push(
      rangeStart === previousLine
        ? `${rangeStart}`
        : `${rangeStart}-${previousLine}`
    );
  };

  for (let rangeIndex = 1; rangeIndex < lineNumbers.length; rangeIndex += 1) {
    const currentLine = lineNumbers[rangeIndex];

    if (currentLine === previousLine + 1) {
      previousLine = currentLine;
      continue;
    }

    flush();
    rangeStart = currentLine;
    previousLine = currentLine;
  }

  flush();

  return parts.join(',');
};

const sortFileEntries = (
  files: Record<string, FileSnapshot>
): Record<string, FileSnapshot> => {
  const sorted: Record<string, FileSnapshot> = Object.create(null);
  const sortedKeys = Object.keys(files).sort((left, right) =>
    left.localeCompare(right)
  );

  for (const key of sortedKeys) sorted[key] = files[key];

  return sorted;
};

const formatSnapshot = (snapshot: CoverageSnapshot): string =>
  `${JSON.stringify(snapshot, null, 2)}\n`;

export const coverageSnapshot = {
  buildMetricDetail,
  compressRanges,
  sortFileEntries,
  formatSnapshot,
} as const;
