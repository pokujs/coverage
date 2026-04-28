import type { NameCellOptions, RenderCell } from '../../@types/table.js';
import { terminal } from '../../utils/terminal.js';

const DIRECTORY_MARKER = '◼ ';

const build = (options: NameCellOptions): RenderCell => {
  const { decoratedName, isDirectory, segmentColor } = options;
  const connectorIndex = Math.max(
    decoratedName.lastIndexOf('├ '),
    decoratedName.lastIndexOf('└ ')
  );

  const marker = isDirectory ? DIRECTORY_MARKER : '';
  const markerDisplay = isDirectory
    ? terminal.colorize(DIRECTORY_MARKER, 'blue')
    : '';

  if (connectorIndex < 0) {
    const text = marker + decoratedName;
    const styledSegment = segmentColor
      ? terminal.colorize(decoratedName, segmentColor)
      : decoratedName;

    if (!isDirectory && !segmentColor) return { text, color: null };
    return { text, color: null, display: markerDisplay + styledSegment };
  }

  const prefix = decoratedName.slice(0, connectorIndex + 2);
  const segment = decoratedName.slice(connectorIndex + 2);
  const text = prefix + marker + segment;
  const display =
    terminal.colorize(prefix, 'dim') +
    markerDisplay +
    (segmentColor ? terminal.colorize(segment, segmentColor) : segment);

  return { text, color: null, display };
};

export const nameCell = { build } as const;
