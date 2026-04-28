import type { ColorName } from './terminal.js';

export type Alignment = 'left' | 'right';

export type Column = {
  header: string;
  align: Alignment;
};

export type RenderCell = {
  text: string;
  color: ColorName | null;
  display?: string;
};

export type TableRow =
  | { kind: 'data'; cells: RenderCell[] }
  | { kind: 'separator' };

export type NameCellOptions = {
  decoratedName: string;
  isDirectory: boolean;
  segmentColor: ColorName | null;
};
