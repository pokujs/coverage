import type { UrlBuilder } from '../../@types/ide.js';
import type { Runtime } from '../../@types/reporters.js';
import type {
  ColorName,
  Column,
  RenderCell,
  Row,
  RowMetrics,
  UncoveredEntry,
} from '../../@types/text.js';
import type { CoverageModel } from '../../@types/tree.js';
import type { Watermarks } from '../../@types/watermarks.js';
import { hyperlink } from '../../utils/terminal.js';
import { colorEnabled, colorForPct, colorize } from '../shared/color.js';
import {
  aggregateLines,
  aggregateMetric,
  pctValue,
  resolveDisplayPct,
} from '../shared/metrics.js';
import { shouldHideFileRow } from '../shared/skip.js';
import {
  formatArmPosition,
  formatRange,
  formatUncoveredEntry,
  truncateUncovered,
  TRUNCATION_SUFFIX,
} from './ranges.js';
import { buildTree, walkTree } from './tree.js';

const formatPctValue = (value: number | null): string =>
  value === null ? '-' : value.toFixed(2);

const isFileRowHidden = (
  row: Row,
  skipFull: boolean,
  skipEmpty: boolean
): boolean => {
  if (!row.absolutePath || !row.metrics) return false;
  return shouldHideFileRow(row.metrics, skipFull, skipEmpty);
};

const BOX = {
  topLeft: '┌',
  topMid: '┬',
  topRight: '┐',
  midLeft: '├',
  midCross: '┼',
  midRight: '┤',
  botLeft: '└',
  botMid: '┴',
  botRight: '┘',
  vert: '│',
  horiz: '─',
};

const horizontalLine = (widths: number[], middle: string): string => {
  const parts = widths.map((columnWidth) => BOX.horiz.repeat(columnWidth));
  return colorize(parts.join(BOX.horiz + middle + BOX.horiz), 'dimGray');
};

const dataRow = (
  cells: RenderCell[],
  widths: number[],
  columns: Column[]
): string => {
  const parts: string[] = [];
  for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
    const renderCell = cells[cellIndex];
    const width = widths[cellIndex];
    const align = columns[cellIndex].align;
    const visible = renderCell.display ?? renderCell.text;

    let padded: string;

    if (renderCell.text.length >= width) {
      padded = visible;
    } else {
      const padding = ' '.repeat(width - renderCell.text.length);
      padded = align === 'left' ? visible + padding : padding + visible;
    }

    parts.push(renderCell.color ? colorize(padded, renderCell.color) : padded);
  }

  const separator = colorize(BOX.vert, 'dimGray');
  return parts.join(' ' + separator + ' ');
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
          ? formatRange(entry.range)
          : formatArmPosition(entry.position);

      const linked =
        urlBuilder && absolutePath
          ? hyperlink(
              text,
              absolutePath,
              entry.kind === 'range' ? entry.range.start : entry.position.line,
              entry.kind === 'range' ? 1 : entry.position.column + 1,
              urlBuilder
            )
          : text;

      return colorize(linked, colorForUncoveredEntry(entry));
    })
    .join(', ');

  if (!truncated) return rendered;
  const truncationMark = colorize(TRUNCATION_SUFFIX, 'gray');
  return rendered + truncationMark;
};

const averageColor = (
  resolvedWatermarks: Watermarks,
  metrics: RowMetrics | null
): ColorName | null => {
  if (!metrics) return null;

  const percentages: number[] = [];

  for (const metric of [
    metrics.statements,
    metrics.branches,
    metrics.functions,
    metrics.lines,
  ]) {
    const percentage = pctValue(metric);
    if (percentage !== null) percentages.push(percentage);
  }

  if (percentages.length === 0)
    return colorForPct(resolvedWatermarks, 'lines', null);

  const average =
    percentages.reduce((sum, percentage) => sum + percentage, 0) /
    percentages.length;

  return colorForPct(resolvedWatermarks, 'lines', average);
};

const DIRECTORY_MARKER = '◼ ';

const nameCell = (
  resolvedWatermarks: Watermarks,
  name: string,
  metrics: RowMetrics | null,
  isDirectory: boolean
): RenderCell => {
  const segmentColor: ColorName | null = isDirectory
    ? 'gray'
    : averageColor(resolvedWatermarks, metrics);
  const connectorIndex = Math.max(
    name.lastIndexOf('├ '),
    name.lastIndexOf('└ ')
  );

  const marker = isDirectory ? DIRECTORY_MARKER : '';
  const markerDisplay = isDirectory ? colorize(DIRECTORY_MARKER, 'blue') : '';

  if (connectorIndex < 0) {
    const text = marker + name;
    const styledSegment = segmentColor ? colorize(name, segmentColor) : name;
    if (!isDirectory && !segmentColor) return { text, color: null };
    return { text, color: null, display: markerDisplay + styledSegment };
  }

  const prefix = name.slice(0, connectorIndex + 2);
  const segment = name.slice(connectorIndex + 2);
  const text = prefix + marker + segment;
  const display =
    colorize(prefix, 'dim') +
    markerDisplay +
    (segmentColor ? colorize(segment, segmentColor) : segment);

  return { text, color: null, display };
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
      nameCell(resolvedWatermarks, row.name, null, isDirectoryRow),
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
      { text: '', color: null },
    ];
  }

  if (isDirectoryRow) {
    return [
      nameCell(resolvedWatermarks, row.name, row.metrics, true),
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

  const { visible, truncated } = truncateUncovered(entries);

  const baseText = visible.map(formatUncoveredEntry).join(', ');

  const uncoveredText = truncated ? baseText + TRUNCATION_SUFFIX : baseText;

  const uncoveredDisplay =
    uncoveredText.length > 0
      ? buildUncoveredDisplay(visible, row.absolutePath, urlBuilder, truncated)
      : undefined;

  const uncoveredCell: RenderCell = {
    text: uncoveredText,
    color: null,
    display: uncoveredDisplay,
  };

  const statementsPct = resolveDisplayPct(
    row.metrics.statements,
    runtime,
    'statements'
  );

  const branchesPct = resolveDisplayPct(
    row.metrics.branches,
    runtime,
    'branches'
  );

  const functionsPct = resolveDisplayPct(
    row.metrics.functions,
    runtime,
    'functions'
  );

  const linesPct = resolveDisplayPct(row.metrics.lines, runtime, 'lines');

  return [
    nameCell(resolvedWatermarks, row.name, row.metrics, false),
    {
      text: formatPctValue(statementsPct),
      color: colorForPct(resolvedWatermarks, 'statements', statementsPct),
    },
    {
      text: formatPctValue(branchesPct),
      color: colorForPct(resolvedWatermarks, 'branches', branchesPct),
    },
    {
      text: formatPctValue(functionsPct),
      color: colorForPct(resolvedWatermarks, 'functions', functionsPct),
    },
    {
      text: formatPctValue(linesPct),
      color: colorForPct(resolvedWatermarks, 'lines', linesPct),
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

  walkTree(coverageTree, '', 0, walkedRows);

  const tableRows =
    skipFull || skipEmpty
      ? walkedRows.filter((row) => !isFileRowHidden(row, skipFull, skipEmpty))
      : walkedRows;

  if (tableRows.length === 0) return '';

  const aggregatedBranches = aggregateMetric(model, (file) => file.branches);
  const aggregatedFunctions = aggregateMetric(model, (file) => file.functions);
  const aggregatedLines = aggregateLines(model);

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

  const widths = columns.map((column, columnIndex) => {
    let columnWidth = column.header.length;

    for (const cells of rowCells) {
      const length = cells[columnIndex].text.length;
      if (length > columnWidth) columnWidth = length;
    }

    const summaryLength = summaryCells[columnIndex].text.length;
    if (summaryLength > columnWidth) columnWidth = summaryLength;

    return columnWidth;
  });

  const lines: string[] = [];

  lines.push(horizontalLine(widths, BOX.topMid));

  const headerCells: RenderCell[] = columns.map((column) => ({
    text: column.header,
    color: 'dim',
  }));

  lines.push(dataRow(headerCells, widths, columns));
  lines.push(horizontalLine(widths, BOX.midCross));

  for (const cells of rowCells) lines.push(dataRow(cells, widths, columns));

  lines.push(horizontalLine(widths, BOX.midCross));
  lines.push(dataRow(summaryCells, widths, columns));
  lines.push(horizontalLine(widths, BOX.botMid));

  if (colorEnabled()) {
    lines.push('');
    lines.push(`${colorize('◼', 'pink')} Uncovered lines`);
    lines.push(`${colorize('◼', 'purple')} Uncovered branches and functions`);
  }

  return lines.join('\n');
};
