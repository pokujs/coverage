import type {
  HtmlSpaDataInput,
  HtmlSpaMetricData,
  HtmlSpaNode,
} from '../../@types/html.js';
import type { Metric, RowMetrics } from '../../@types/text.js';
import type { TreeNode } from '../../@types/tree.js';
import type {
  WatermarkLevel,
  WatermarkMetric,
  Watermarks,
} from '../../@types/watermarks.js';
import { watermarks } from '../../watermarks.js';
import {
  metricsForFile,
  metricsForSubtree,
} from '../shared/html/row-metrics.js';
import { pctValue } from '../shared/metrics.js';
import { shouldHideFileRow } from '../shared/skip.js';

const round2 = (value: number): number => Math.round(value * 100) / 100;

const metricData = (
  metric: Metric,
  metricName: WatermarkMetric,
  resolvedWatermarks: Watermarks
): HtmlSpaMetricData => {
  const total = metric.total ?? 0;
  const covered = metric.hit ?? 0;
  const isEmpty = total === 0;
  const percentage = pctValue(metric);
  const pct = isEmpty || percentage === null ? 100 : round2(percentage);

  const classForPercent: WatermarkLevel | 'empty' = isEmpty
    ? 'empty'
    : (watermarks.classForPercent(resolvedWatermarks, metricName, percentage) ??
      'empty');

  return {
    total,
    covered,
    missed: total - covered,
    skipped: 0,
    pct,
    classForPercent,
  };
};

const nodeMetrics = (
  metrics: RowMetrics,
  resolvedWatermarks: Watermarks
): HtmlSpaNode['metrics'] => ({
  statements: metricData(metrics.statements, 'statements', resolvedWatermarks),
  branches: metricData(metrics.branches, 'branches', resolvedWatermarks),
  functions: metricData(metrics.functions, 'functions', resolvedWatermarks),
  lines: metricData(metrics.lines, 'lines', resolvedWatermarks),
});

export const buildHtmlSpaNode = (
  node: TreeNode,
  input: HtmlSpaDataInput
): HtmlSpaNode => {
  if (node.isFile) {
    if (!node.file) {
      return {
        file: node.segment,
        isEmpty: true,
        metrics: nodeMetrics(
          {
            statements: { total: null, hit: null },
            branches: { total: null, hit: null },
            functions: { total: null, hit: null },
            lines: { total: null, hit: null },
            uncoveredRanges: [],
            uncoveredBranchPositions: [],
          },
          input.resolvedWatermarks
        ),
      };
    }

    const metrics = metricsForFile(node.file);

    return {
      file: node.segment,
      isEmpty: (metrics.lines.total ?? 0) === 0,
      metrics: nodeMetrics(metrics, input.resolvedWatermarks),
    };
  }

  const children: HtmlSpaNode[] = [];
  const metrics = metricsForSubtree(node);

  for (const childNode of node.children) {
    if (childNode.isFile && childNode.file) {
      const childMetrics = metricsForFile(childNode.file);
      if (shouldHideFileRow(childMetrics, input.skipFull, input.skipEmpty))
        continue;
    }

    children.push(buildHtmlSpaNode(childNode, input));
  }

  return {
    file: node.segment,
    isEmpty: (metrics.lines.total ?? 0) === 0,
    metrics: nodeMetrics(metrics, input.resolvedWatermarks),
    children,
  };
};
