import type { Runtime } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { CoverageModel } from '../../@types/tree.js';
import type { WatermarkMetric } from '../../@types/watermarks.js';

export const emptyMetric = (): Metric => ({ total: null, hit: null });

export const metricTotal = (metric: Metric): number => metric.total ?? 0;

export const metricCovered = (metric: Metric): number => metric.hit ?? 0;

export const metricRate = (metric: Metric): number | null => {
  const total = metric.total ?? 0;
  if (total === 0) return null;

  const hit = metric.hit ?? 0;

  return Math.round((hit / total) * 10000) / 10000;
};

export const linesMetric = (lineHits: Map<number, number>): Metric => {
  if (lineHits.size === 0) return emptyMetric();

  return {
    total: lineHits.size,
    hit: Array.from(lineHits.values()).filter((hitCount) => hitCount > 0)
      .length,
  };
};

export const pctValue = (metric: Metric): number | null => {
  if (metric.total === null || metric.hit === null) return null;
  if (metric.total === 0) return null;
  return (metric.hit / metric.total) * 100;
};

export const resolveDisplayPct = (
  metric: Metric,
  runtime: Runtime,
  metricName: WatermarkMetric
): number | null => {
  const percentage = pctValue(metric);

  if (percentage !== null) return percentage;
  if (runtime === 'bun' && metricName === 'branches') return null;
  return null;
};

export const formatPct = (value: number | null): string =>
  value === null ? '-' : `${value.toFixed(2)} %`;

export const aggregateMetric = <SourceFile>(
  files: readonly SourceFile[],
  pickMetric: (sourceFile: SourceFile) => Metric
): Metric => {
  let total = 0;
  let hit = 0;
  let hasMetrics = false;

  for (const sourceFile of files) {
    const metric = pickMetric(sourceFile);
    if (metric.total === null || metric.hit === null) continue;

    total += metric.total;
    hit += metric.hit;
    hasMetrics = true;
  }

  return hasMetrics ? { total, hit } : emptyMetric();
};

export const aggregateLines = (files: CoverageModel): Metric => {
  let total = 0;
  let hit = 0;
  let hasMetrics = false;

  for (const sourceFile of files) {
    const metric = linesMetric(sourceFile.lineHits);
    if (metric.total === null || metric.hit === null) continue;

    total += metric.total;
    hit += metric.hit;
    hasMetrics = true;
  }

  return hasMetrics ? { total, hit } : emptyMetric();
};
