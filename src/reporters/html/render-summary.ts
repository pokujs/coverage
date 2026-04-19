import type {
  HtmlSummaryChild,
  HtmlSummaryPageInput,
} from '../../@types/html.js';
import type { Runtime } from '../../@types/reporters.js';
import type { Metric } from '../../@types/text.js';
import type { WatermarkMetric } from '../../@types/watermarks.js';
import { htmlEscape } from '../../utils/html.js';
import { relativeHref } from '../shared/html/link-mapper.js';
import {
  overallReportClass,
  renderFooter,
  renderHeader,
} from '../shared/html/templates.js';
import { formatPct, pctValue, resolveDisplayPct } from '../shared/metrics.js';

const METRIC_ORDER: readonly ['statements', 'branches', 'functions', 'lines'] =
  ['statements', 'branches', 'functions', 'lines'];

const percentGraph = (percentage: number | null): string => {
  if (percentage === null || !Number.isFinite(percentage)) return '';

  const cssClasses = ['cover-fill'];
  if (percentage === 100) cssClasses.push('cover-full');

  const flooredPercentage = Math.floor(percentage);

  return [
    `<div class="${cssClasses.join(' ')}" style="width: ${flooredPercentage}%"></div>`,
    `<div class="cover-empty" style="width: ${100 - flooredPercentage}%"></div>`,
  ].join('');
};

const summaryCell = (
  metric: Metric,
  reportClass: string,
  showGraph: boolean,
  runtime: Runtime,
  metricName: WatermarkMetric
): string => {
  const parts: string[] = [];
  const percentage = pctValue(metric);

  if (percentage === null) {
    const metricAbsent =
      resolveDisplayPct(metric, runtime, metricName) === null;

    if (metricAbsent) {
      if (showGraph) {
        parts.push(
          `<td data-value="-1" class="pic ${reportClass}">`,
          `<div class="chart">${percentGraph(null)}</div>`,
          `</td>`
        );
      }

      parts.push(
        `<td data-value="-1" class="pct ${reportClass}">-</td>`,
        `<td data-value="-1" class="abs ${reportClass}">-</td>`
      );

      return parts.join('\n\t');
    }

    const total = metric.total ?? 0;
    const covered = metric.hit ?? 0;

    if (showGraph) {
      parts.push(
        `<td data-value="0" class="pic ${reportClass}">`,
        `<div class="chart">${percentGraph(null)}</div>`,
        `</td>`
      );
    }

    parts.push(
      `<td data-value="0" class="pct ${reportClass}">0%</td>`,
      `<td data-value="${total}" class="abs ${reportClass}">${covered}/${total}</td>`
    );

    return parts.join('\n\t');
  }

  const displayPercentage = (Math.round(percentage * 100) / 100).toString();
  const total = metric.total ?? 0;
  const covered = metric.hit ?? 0;

  if (showGraph) {
    parts.push(
      `<td data-value="${displayPercentage}" class="pic ${reportClass}">`,
      `<div class="chart">${percentGraph(percentage)}</div>`,
      `</td>`
    );
  }

  parts.push(
    `<td data-value="${displayPercentage}" class="pct ${reportClass}">${displayPercentage}%</td>`,
    `<td data-value="${total}" class="abs ${reportClass}">${covered}/${total}</td>`
  );

  return parts.join('\n\t');
};

const summaryRow = (
  summaryChild: HtmlSummaryChild,
  pagePath: string,
  runtime: Runtime
): string => {
  const displayName = summaryChild.isDirectory
    ? `${summaryChild.displayName}/`
    : summaryChild.displayName;

  const href = htmlEscape(
    relativeHref(pagePath, summaryChild.relativeLinkPath)
  );

  const escapedName = htmlEscape(displayName);

  const statementsCell = summaryCell(
    summaryChild.metrics.statements,
    summaryChild.watermarkClasses.statements,
    true,
    runtime,
    'statements'
  );

  const branchesCell = summaryCell(
    summaryChild.metrics.branches,
    summaryChild.watermarkClasses.branches,
    false,
    runtime,
    'branches'
  );

  const functionsCell = summaryCell(
    summaryChild.metrics.functions,
    summaryChild.watermarkClasses.functions,
    false,
    runtime,
    'functions'
  );

  const linesCell = summaryCell(
    summaryChild.metrics.lines,
    summaryChild.watermarkClasses.lines,
    false,
    runtime,
    'lines'
  );

  return [
    '<tr>',
    `<td class="file ${summaryChild.watermarkClasses.statements}" data-value="${escapedName}"><a href="${href}">${escapedName}</a></td>`,
    statementsCell,
    branchesCell,
    functionsCell,
    linesCell,
    '</tr>\n',
  ].join('\n\t');
};

const TABLE_HEADER = [
  '<div class="pad1">',
  '<table class="coverage-summary">',
  '<thead>',
  '<tr>',
  '   <th data-col="file" data-fmt="html" data-html="true" class="file">File</th>',
  '   <th data-col="pic" data-type="number" data-fmt="html" data-html="true" class="pic"></th>',
  '   <th data-col="statements" data-type="number" data-fmt="pct" class="pct">Statements</th>',
  '   <th data-col="statements_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="branches" data-type="number" data-fmt="pct" class="pct">Branches</th>',
  '   <th data-col="branches_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="functions" data-type="number" data-fmt="pct" class="pct">Functions</th>',
  '   <th data-col="functions_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="lines" data-type="number" data-fmt="pct" class="pct">Lines</th>',
  '   <th data-col="lines_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '</tr>',
  '</thead>',
  '<tbody>',
].join('\n');

const TABLE_FOOTER = ['</tbody>', '</table>', '</div>'].join('\n');

export const renderSummaryPage = (input: HtmlSummaryPageInput): string => {
  const childRows = input.children.map((summaryChild) =>
    summaryRow(summaryChild, input.pagePath, input.runtime)
  );

  const reportClass = overallReportClass(
    input.resolvedWatermarks,
    input.metrics
  );

  const header = renderHeader({
    title: input.title,
    pagePath: input.pagePath,
    breadcrumb: input.breadcrumb,
    currentLabel: input.currentLabel,
    metrics: input.metrics,
    reportClass,
    datetime: input.datetime,
    runtime: input.runtime,
  });

  const footer = renderFooter({
    title: input.title,
    pagePath: input.pagePath,
    breadcrumb: input.breadcrumb,
    currentLabel: input.currentLabel,
    metrics: input.metrics,
    reportClass,
    datetime: input.datetime,
    runtime: input.runtime,
  });

  const formattedTotals = METRIC_ORDER.map((metricName) => {
    const metric = input.metrics[metricName];
    return `${metricName}: ${formatPct(pctValue(metric))}`;
  }).join(' · ');

  const signature = `<!-- ${htmlEscape(formattedTotals)} -->\n`;

  return `${header}${signature}${TABLE_HEADER}\n${childRows.join('')}${TABLE_FOOTER}${footer}`;
};
