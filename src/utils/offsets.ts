import type { LineColumn } from '../@types/offsets.js';

const lineStarts = (source: string): number[] => {
  const buffer = Buffer.from(source, 'utf8');
  const starts: number[] = [0];

  for (let byteIndex = 0; byteIndex < buffer.length; byteIndex++) {
    if (buffer[byteIndex] === 0x0a /* \n */) starts.push(byteIndex + 1);
  }

  starts.push(buffer.length);
  return starts;
};

const rangeLines = (
  startByte: number,
  endByte: number,
  lineStartTable: number[]
): [number, number] => {
  let low = 0;
  let high = lineStartTable.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >>> 1;

    if (lineStartTable[middle] <= startByte) low = middle;
    else high = middle - 1;
  }

  const first = low + 1;

  low = 0;
  high = lineStartTable.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >>> 1;

    if (lineStartTable[middle] < endByte) low = middle;
    else high = middle - 1;
  }

  const last = Math.max(first, low + 1);
  return [first, last];
};

const findLineIndex = (
  lineStartTable: number[],
  byteOffset: number
): number => {
  let low = 0;
  let high = lineStartTable.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >>> 1;

    if (lineStartTable[middle] <= byteOffset) low = middle;
    else high = middle - 1;
  }

  return low;
};

const toLocation = (offset: number, lineStartTable: number[]): LineColumn => {
  const lineIndex = findLineIndex(lineStartTable, offset);

  return {
    line: lineIndex + 1,
    column: offset - lineStartTable[lineIndex],
  };
};

const lineContentExtents = (
  source: string,
  lineStartTable: number[]
): Array<[number, number] | null> => {
  const buffer = Buffer.from(source, 'utf8');
  const totalLines = lineStartTable.length - 1;
  const extents: Array<[number, number] | null> = new Array(totalLines);

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    const lineStart = lineStartTable[lineIndex];
    const lineEnd = lineStartTable[lineIndex + 1];

    let firstContentByte = -1;

    for (let byteIndex = lineStart; byteIndex < lineEnd; byteIndex++) {
      const byteValue = buffer[byteIndex];

      if (
        byteValue === 0x20 ||
        byteValue === 0x09 ||
        byteValue === 0x0a ||
        byteValue === 0x0d
      )
        continue;

      firstContentByte = byteIndex;
      break;
    }

    if (firstContentByte === -1) {
      extents[lineIndex] = null;
      continue;
    }

    let lastContentByte = firstContentByte;

    for (
      let byteIndex = lineEnd - 1;
      byteIndex > firstContentByte;
      byteIndex--
    ) {
      const byteValue = buffer[byteIndex];

      if (
        byteValue === 0x20 ||
        byteValue === 0x09 ||
        byteValue === 0x0a ||
        byteValue === 0x0d
      )
        continue;

      lastContentByte = byteIndex;
      break;
    }

    extents[lineIndex] = [firstContentByte, lastContentByte];
  }

  return extents;
};

const toOffset = (location: LineColumn, lineStartTable: number[]): number => {
  const lineIndex = location.line - 1;

  if (lineIndex < 0) return 0;
  if (lineIndex >= lineStartTable.length) {
    return lineStartTable.at(-1)!;
  }

  return lineStartTable[lineIndex] + location.column;
};

export const offsets = {
  lineStarts,
  rangeLines,
  findLineIndex,
  lineContentExtents,
  toLocation,
  toOffset,
} as const;
