import type { PathTreeNode } from '../../@types/path-tree.js';
import type { Column, RenderCell, TableRow } from '../../@types/table.js';
import type { ColorName, UrlBuilder } from '../../@types/terminal.js';
import type {
  FileTypeCoverage,
  TypeCoverageReport,
} from '../../@types/type-coverage.js';
import type { Watermarks } from '../../@types/watermarks.js';
import { terminal } from '../../utils/terminal.js';
import { nameCell } from '../shared/name-cell.js';
import { pathTree } from '../shared/path-tree.js';
import { ranges } from '../shared/ranges.js';
import { tableRenderer } from '../shared/table.js';
import { watermarks } from '../shared/watermarks.js';

const COLUMNS: readonly Column[] = [
  { header: 'Type Files', align: 'left' },
  { header: '% Referenced', align: 'right' },
  { header: '% Tested', align: 'right' },
  { header: 'Uncovered Lines', align: 'left' },
];

const formatPercentage = (numerator: number, denominator: number): string => {
  if (denominator === 0) return '-';
  return ((numerator / denominator) * 100).toFixed(2);
};

const computePercentage = (
  numerator: number,
  denominator: number
): number | null => {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
};

const formatLineList = (lines: readonly number[]): string => {
  if (lines.length === 0) return '';

  const collapsed = ranges.collapseRanges(lines);
  return collapsed.map(ranges.formatRange).join(', ');
};

const renderLinkedRanges = (
  lines: readonly number[],
  color: ColorName,
  absolutePath: string,
  urlBuilder: UrlBuilder | null
): string => {
  const collapsed = ranges.collapseRanges(lines);
  return collapsed
    .map((range) => {
      const text = ranges.formatRange(range);
      const linked = urlBuilder
        ? terminal.hyperlink(text, absolutePath, range.start, 1, urlBuilder)
        : text;

      return terminal.colorize(linked, color);
    })
    .join(', ');
};

const buildUncoveredCell = (
  file: FileTypeCoverage,
  urlBuilder: UrlBuilder | null
): RenderCell => {
  const unusedText = formatLineList(file.unusedLines);
  const untestedText = formatLineList(file.untestedOnlyLines);

  if (unusedText.length === 0 && untestedText.length === 0)
    return { text: '', color: null };

  const visibleParts: string[] = [];
  const displayParts: string[] = [];

  if (unusedText.length > 0) {
    visibleParts.push(unusedText);
    displayParts.push(
      renderLinkedRanges(
        file.unusedLines,
        'pink',
        file.absolutePath,
        urlBuilder
      )
    );
  }

  if (untestedText.length > 0) {
    visibleParts.push(untestedText);
    displayParts.push(
      renderLinkedRanges(
        file.untestedOnlyLines,
        'purple',
        file.absolutePath,
        urlBuilder
      )
    );
  }

  return {
    text: visibleParts.join(', '),
    color: null,
    display: displayParts.join(', '),
  };
};

const averageColor = (
  resolvedWatermarks: Watermarks,
  used: number,
  tested: number,
  total: number,
  testsConfigured: boolean
): ColorName | null => {
  if (total === 0) return null;

  const usedPercent = (used / total) * 100;

  if (!testsConfigured)
    return watermarks.colorForPercent(resolvedWatermarks, 'used', usedPercent);

  const testedPercent = (tested / total) * 100;
  const average = (usedPercent + testedPercent) / 2;

  return watermarks.colorForPercent(resolvedWatermarks, 'used', average);
};

const buildFileRow = (
  file: FileTypeCoverage,
  decoratedName: string,
  resolvedWatermarks: Watermarks,
  urlBuilder: UrlBuilder | null,
  testsConfigured: boolean
): TableRow => {
  const usedPercent = computePercentage(file.used, file.total);
  const testedPercent = testsConfigured
    ? computePercentage(file.tested, file.total)
    : null;

  const segmentColor = averageColor(
    resolvedWatermarks,
    file.used,
    file.tested,
    file.total,
    testsConfigured
  );

  const cells: RenderCell[] = [
    nameCell.build({ decoratedName, isDirectory: false, segmentColor }),
    {
      text: formatPercentage(file.used, file.total),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'used',
        usedPercent
      ),
    },
    {
      text: testsConfigured ? formatPercentage(file.tested, file.total) : '-',
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'tested',
        testedPercent
      ),
    },
    buildUncoveredCell(file, urlBuilder),
  ];

  return { kind: 'data', cells };
};

const aggregate = (
  files: readonly FileTypeCoverage[]
): { total: number; used: number; tested: number } => {
  let total = 0;
  let used = 0;
  let tested = 0;

  for (const file of files) {
    total += file.total;
    used += file.used;
    tested += file.tested;
  }

  return { total, used, tested };
};

const buildDirectoryRow = (
  node: PathTreeNode<FileTypeCoverage>,
  decoratedName: string,
  resolvedWatermarks: Watermarks,
  testsConfigured: boolean
): TableRow => {
  const descendants = pathTree.collectPayloads(node);
  const totals = aggregate(descendants);
  const testedPercent = testsConfigured
    ? computePercentage(totals.tested, totals.total)
    : null;

  const cells: RenderCell[] = [
    nameCell.build({
      decoratedName,
      isDirectory: true,
      segmentColor: 'gray',
    }),
    {
      text: formatPercentage(totals.used, totals.total),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'used',
        computePercentage(totals.used, totals.total)
      ),
    },
    {
      text: testsConfigured
        ? formatPercentage(totals.tested, totals.total)
        : '-',
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'tested',
        testedPercent
      ),
    },
    { text: '', color: null },
  ];

  return { kind: 'data', cells };
};

const buildSummaryRow = (
  totals: { total: number; used: number; tested: number },
  resolvedWatermarks: Watermarks,
  testsConfigured: boolean
): TableRow => {
  const usedPercent = computePercentage(totals.used, totals.total);
  const testedPercent = testsConfigured
    ? computePercentage(totals.tested, totals.total)
    : null;

  const cells: RenderCell[] = [
    { text: 'All files', color: 'dim' },
    {
      text: formatPercentage(totals.used, totals.total),
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'used',
        usedPercent
      ),
    },
    {
      text: testsConfigured
        ? formatPercentage(totals.tested, totals.total)
        : '-',
      color: watermarks.colorForPercent(
        resolvedWatermarks,
        'tested',
        testedPercent
      ),
    },
    { text: '', color: null },
  ];

  return { kind: 'data', cells };
};

const render = (
  report: TypeCoverageReport,
  cwd: string,
  resolvedWatermarks: Watermarks,
  urlBuilder: UrlBuilder | null
): string => {
  if (report.files.size === 0) return '';

  const fileList = [...report.files.values()];
  const root = pathTree.build<FileTypeCoverage>(
    fileList,
    (file) => file.absolutePath,
    cwd
  );

  const tableRows: TableRow[] = [];

  pathTree.walk(root, (child, context) => {
    if (child.isFile && child.payload !== undefined) {
      tableRows.push(
        buildFileRow(
          child.payload,
          context.decoratedName,
          resolvedWatermarks,
          urlBuilder,
          report.testsConfigured
        )
      );
      return;
    }

    tableRows.push(
      buildDirectoryRow(
        child,
        context.decoratedName,
        resolvedWatermarks,
        report.testsConfigured
      )
    );
  });

  if (tableRows.length === 0) return '';

  tableRows.push({ kind: 'separator' });
  tableRows.push(
    buildSummaryRow(
      aggregate(fileList),
      resolvedWatermarks,
      report.testsConfigured
    )
  );

  const table = tableRenderer.render(COLUMNS, tableRows);
  if (table.length === 0) return '';

  if (!terminal.isColorEnabled()) return table;

  const legendLines = [`${terminal.colorize('◼', 'pink')} Unreferenced types`];

  if (report.testsConfigured)
    legendLines.push(`${terminal.colorize('◼', 'purple')} Untested types`);

  return `${table}\n\n${legendLines.join('\n')}`;
};

export const typesTable = { render } as const;
