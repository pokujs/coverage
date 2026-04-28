import type { Column, RenderCell, TableRow } from '../../@types/table.js';
import { terminal } from '../../utils/terminal.js';

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
} as const;

const horizontalLine = (widths: readonly number[], middle: string): string => {
  const parts = widths.map((columnWidth) => BOX.horiz.repeat(columnWidth));
  return terminal.colorize(
    parts.join(BOX.horiz + middle + BOX.horiz),
    'dimGray'
  );
};

const renderDataRow = (
  cells: readonly RenderCell[],
  widths: readonly number[],
  columns: readonly Column[]
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

    parts.push(
      renderCell.color ? terminal.colorize(padded, renderCell.color) : padded
    );
  }

  const separator = terminal.colorize(BOX.vert, 'dimGray');

  return parts.join(' ' + separator + ' ');
};

const computeWidths = (
  columns: readonly Column[],
  rows: readonly TableRow[]
): number[] =>
  columns.map((column, columnIndex) => {
    let columnWidth = column.header.length;

    for (const row of rows) {
      if (row.kind !== 'data') continue;
      const length = row.cells[columnIndex].text.length;
      if (length > columnWidth) columnWidth = length;
    }

    return columnWidth;
  });

const headerRow = (columns: readonly Column[]): TableRow => ({
  kind: 'data',
  cells: columns.map((column) => ({
    text: column.header,
    color: 'dim',
  })),
});

const render = (
  columns: readonly Column[],
  rows: readonly TableRow[]
): string => {
  if (rows.length === 0) return '';

  const allRows: TableRow[] = [
    { kind: 'separator' },
    headerRow(columns),
    { kind: 'separator' },
    ...rows,
    { kind: 'separator' },
  ];
  const widths = computeWidths(columns, allRows);
  const lines: string[] = [];

  let lineIndex = 0;

  for (const row of allRows) {
    if (row.kind === 'separator') {
      let middle: string;
      if (lineIndex === 0) middle = BOX.topMid;
      else if (lineIndex === allRows.length - 1) middle = BOX.botMid;
      else middle = BOX.midCross;

      lines.push(horizontalLine(widths, middle));
    } else {
      lines.push(renderDataRow(row.cells, widths, columns));
    }

    lineIndex += 1;
  }

  return lines.join('\n');
};

export const tableRenderer = { render } as const;
