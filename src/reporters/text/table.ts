import type { Runtime } from '../../@types/reporters.js';
import type { Column, RenderCell, TableRow } from '../../@types/table.js';
import type { UrlBuilder } from '../../@types/terminal.js';
import type {
  ColorName,
  Row,
  RowMetrics,
  UncoveredEntry,
} from '../../@types/text.js';
import type { CoverageModel } from '../../@types/tree.js';
import type { Watermarks } from '../../@types/watermarks.js';
import { terminal } from '../../utils/terminal.js';
import { metrics } from '../shared/metrics.js';
import { nameCell } from '../shared/name-cell.js';
import { ranges } from '../shared/ranges.js';
import { skip } from '../shared/skip.js';
import { tableRenderer } from '../shared/table.js';
import { watermarks } from '../shared/watermarks.js';
import { buildTree, walkTree } from './tree.js';

const formatPercentageValue = (value: number | null): string =>
  value === null ? '-' : value.toFixed(2);

const isFileRowHidden = (
  row: Row,
  skipFull: boolean,
  skipEmpty: boolean
): boolean => {
  if (!row.absolutePath || !row.metrics) return false;
  return skip.shouldHideFileRow(row.metrics, skipFull, skipEmpty);
};

const colorForUncoveredEntry = (entry: UncoveredEntry): ColorName =>
  entry.kind === 'range' ? 'pink' : 'purple';

const buildUncoveredDisplay = (
  entries: UncoveredEntry[],
  absolutePath: string | undefined,
  urlBuilder: UrlBuilder | null,
  truncated: boolean
): string => {
  const rendered = entries
    .map((entry) => {
      const text =
        entry.kind === 'range'
          ? ranges.formatRange(entry.range)
          : ranges.formatArmPosition(entry.position);

      const linked =
        urlBuilder && absolutePath
          ? terminal.hyperlink(
              text,
              absolutePath,
              entry.kind === 'range' ? entry.range.start : entry.position.line,
              entry.kind === 'range' ? 1 : entry.position.column + 1,
              urlBuilder
            )
          : text;

      return terminal.colorize(linked, colorForUncoveredEntry(entry));
    })
    .join(', ');

  if (!truncated) return rendered;
  const truncationMark = terminal.colorize(ranges.TRUNCATION_SUFFIX, 'gray');
  return rendered + truncationMark;
};

const averageColor = (
  resolvedWatermarks: Watermarks,
  rowMetrics: RowMetrics | null
): ColorName | null => {
  if (!rowMetrics) return null;

  const percentages: number[] = [];

  for (const metric of [
    rowMetrics.statements,
    rowMetrics.branches,
    rowMetrics.functions,
    rowMetrics.lines,
  ]) {
    const percentage = metrics.computePercentage(metric);
    if (percentage !== null) percentages.push(percentage);
  }

  if (percentages.length === 0)
    return watermarks.colorForPercent(resolvedWatermarks, 'lines', null);

  const average =
    percentages.reduce((sum, percentage) => sum + percentage, 0) /
    percentages.length;

  return watermarks.colorForPercent(resolvedWatermarks, 'lines', average);
};

const buildNameCell = (
  resolvedWatermarks: Watermarks,
  name: string,
  rowMetrics: RowMetrics | null,
  isDirectory: boolean
): RenderCell => {
  const segmentColor: ColorName | null = isDirectory
    ? 'gray'
    : averageColor(resolvedWatermarks, rowMetrics);

  return nameCell.build({
    decoratedName: name,
    isDirectory,
    segmentColor,
  });
};

const buildRowCells = (
  resolvedWatermarks: Watermarks,
  row: Row,
  urlBuilder: UrlBuilder | null,
  runtime: Runtime,
  isSummary: boolean
): RenderCell[] => {
  const isDirectoryRow = !row.absolutePath && !isSummary;

  if (!row.metrics) {
    return [
      buildNameCell(resolvedWatermarks, row.name, null, isDirectoryRow),
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
    ];
  }

  if (isDirectoryRow) {
    return [
      buildNameCell(resolvedWatermarks, row.name, row.metrics, true),
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
    ];
  }

  const entries: UncoveredEntry[] = [
    ...row.metrics.uncoveredRanges.map(
      (range) => ({ kind: 'range', range }) as const
    ),
    ...row.metrics.uncoveredBranchPositions.map(
      (position) => ({ kind: 'branch', position }) as const
    ),
    ...row.metrics.uncoveredFunctionPositions.map(
      (position) => ({ kind: 'function', position }) as const
    ),
  ];

  const { visible, truncated } = ranges.truncateUncovered(entries);

  const baseText = visible.map(ranges.formatUncoveredEntry).join(', ');

  const uncoveredText = truncated
    ? baseText + ranges.TRUNCATION_SUFFIX
    : baseText;

  const uncoveredDisplay =
    uncoveredText.length > 0
      ? buildUncoveredDisplay(visible, row.absolutePath, urlBuilder, truncated)
      : undefined;

  const uncoveredCell: RenderCell = {
    text: uncoveredText,
    color: null,
    display: uncoveredDisplay,
  };

  const statementsPercentage = metrics.resolveDisplayPercentage(
    row.metrics.statements,
    runtime,
    'statements'
  );

  const branchesPercentage = metrics.resolveDisplayPercentage(
    row.metrics.branches,
    runtime,
    'branches'
  );

  const functionsPercentage = metrics.resolveDisplayPercentage(
    row.metrics.functions,
    runtime,
    'functions'
  );

  const linesPercentage = metrics.resolveDisplayPercentage(
    row.metrics.lines,
    runtime,
    'lines'
  );

  return [
    buildNameCell(resolvedWatermarks, row.name, row.metrics, false),
    {
      text: formatPercentageValue(statementsPercentage),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'statements',
        statementsPercentage
      ),
    },
    {
      text: formatPercentageValue(branchesPercentage),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'branches',
        branchesPercentage
      ),
    },
    {
      text: formatPercentageValue(functionsPercentage),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'functions',
        functionsPercentage
      ),
    },
    {
      text: formatPercentageValue(linesPercentage),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'lines',
        linesPercentage
      ),
    },
    uncoveredCell,
  ];
};

export const renderTable = (
  model: CoverageModel,
  cwd: string,
  urlBuilder: UrlBuilder | null,
  resolvedWatermarks: Watermarks,
  runtime: Runtime,
  skipFull: boolean,
  skipEmpty: boolean
): string => {
  if (model.length === 0) return '';

  const columns: Column[] = [
    { header: 'File', align: 'left' },
    { header: '% Stmts', align: 'right' },
    { header: '% Branch', align: 'right' },
    { header: '% Funcs', align: 'right' },
    { header: '% Lines', align: 'right' },
    { header: 'Uncovered Lines', align: 'left' },
  ];

  const coverageTree = buildTree(model, cwd);
  const walkedRows: Row[] = [];

  walkTree(coverageTree, walkedRows);

  const tableRows =
    skipFull || skipEmpty
      ? walkedRows.filter((row) => !isFileRowHidden(row, skipFull, skipEmpty))
      : walkedRows;

  if (tableRows.length === 0) return '';

  const aggregatedBranches = metrics.aggregateBy(
    model,
    (file) => file.branches
  );
  const aggregatedFunctions = metrics.aggregateBy(
    model,
    (file) => file.functions
  );
  const aggregatedLines = metrics.aggregateLines(model);

  const summaryRow: Row = {
    name: 'All Files',
    metrics: {
      statements: aggregatedLines,
      branches: aggregatedBranches,
      functions: aggregatedFunctions,
      lines: aggregatedLines,
      uncoveredRanges: [],
      uncoveredBranchPositions: [],
      uncoveredFunctionPositions: [],
    },
  };

  const rowCells: RenderCell[][] = tableRows.map((row) =>
    buildRowCells(resolvedWatermarks, row, urlBuilder, runtime, false)
  );

  const summaryCells = buildRowCells(
    resolvedWatermarks,
    summaryRow,
    urlBuilder,
    runtime,
    true
  );

  summaryCells[0] = { text: summaryRow.name, color: 'dim' };

  const tableData: TableRow[] = [];
  for (const cells of rowCells) tableData.push({ kind: 'data', cells });

  tableData.push({ kind: 'separator' });
  tableData.push({ kind: 'data', cells: summaryCells });

  const lines: string[] = [tableRenderer.render(columns, tableData)];

  if (terminal.isColorEnabled()) {
    lines.push('');
    lines.push(`${terminal.colorize('◼', 'pink')} Uncovered lines`);
    lines.push(
      `${terminal.colorize('◼', 'purple')} Uncovered branches and functions`
    );
  }

  return lines.join('\n');
};
