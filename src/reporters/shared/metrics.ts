import type { Runtime } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { CoverageModel } from '../../@types/tree.js';
import type { WatermarkMetric } from '../../@types/watermarks.js';

const empty = (): Metric => ({ total: null, hit: null });

const total = (metric: Metric): number => metric.total ?? 0;

const covered = (metric: Metric): number => metric.hit ?? 0;

const rate = (metric: Metric): number | null => {
  const sum = metric.total ?? 0;
  if (sum === 0) return null;

  const hit = metric.hit ?? 0;

  return Math.round((hit / sum) * 10000) / 10000;
};

const fromLineHits = (lineHits: Map<number, number>): Metric => {
  if (lineHits.size === 0) return empty();

  return {
    total: lineHits.size,
    hit: Array.from(lineHits.values()).filter((hitCount) => hitCount > 0)
      .length,
  };
};

const computePercentage = (metric: Metric): number | null => {
  if (metric.total === null || metric.hit === null) return null;
  if (metric.total === 0) return null;
  return (metric.hit / metric.total) * 100;
};

const resolveDisplayPercentage = (
  metric: Metric,
  runtime: Runtime,
  metricName: WatermarkMetric
): number | null => {
  const percentage = computePercentage(metric);

  if (percentage !== null) return percentage;
  if (runtime === 'bun' && metricName === 'branches') return null;
  return 100;
};

const formatPercentage = (value: number | null): string =>
  value === null ? '-' : `${value.toFixed(2)} %`;

const aggregateBy = <SourceFile>(
  files: readonly SourceFile[],
  pickMetric: (sourceFile: SourceFile) => Metric
): Metric => {
  let totalSum = 0;
  let hit = 0;
  let hasMetrics = false;

  for (const sourceFile of files) {
    const metric = pickMetric(sourceFile);
    if (metric.total === null || metric.hit === null) continue;

    totalSum += metric.total;
    hit += metric.hit;
    hasMetrics = true;
  }

  return hasMetrics ? { total: totalSum, hit } : empty();
};

const aggregateLines = (files: CoverageModel): Metric => {
  let totalSum = 0;
  let hit = 0;
  let hasMetrics = false;

  for (const sourceFile of files) {
    const metric = fromLineHits(sourceFile.lineHits);
    if (metric.total === null || metric.hit === null) continue;

    totalSum += metric.total;
    hit += metric.hit;
    hasMetrics = true;
  }

  return hasMetrics ? { total: totalSum, hit } : empty();
};

export const metrics = {
  empty,
  total,
  covered,
  rate,
  fromLineHits,
  computePercentage,
  resolveDisplayPercentage,
  formatPercentage,
  aggregateBy,
  aggregateLines,
} as const;
