import type { LineColumn } from '../@types/offsets.js';

const lineStarts = (source: string): number[] => {
  const starts: number[] = [0];

  for (let charIndex = 0; charIndex < source.length; charIndex++) {
    if (source.charCodeAt(charIndex) === 0x0a /* \n */)
      starts.push(charIndex + 1);
  }

  starts.push(source.length);
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
  const totalLines = lineStartTable.length - 1;
  const extents: Array<[number, number] | null> = new Array(totalLines);

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    const lineStart = lineStartTable[lineIndex];
    const lineEnd = lineStartTable[lineIndex + 1];

    let firstContentChar = -1;

    for (let charIndex = lineStart; charIndex < lineEnd; charIndex++) {
      const codeUnit = source.charCodeAt(charIndex);

      if (
        codeUnit === 0x20 ||
        codeUnit === 0x09 ||
        codeUnit === 0x0a ||
        codeUnit === 0x0d
      )
        continue;

      firstContentChar = charIndex;
      break;
    }

    if (firstContentChar === -1) {
      extents[lineIndex] = null;
      continue;
    }

    let lastContentChar = firstContentChar;

    for (
      let charIndex = lineEnd - 1;
      charIndex > firstContentChar;
      charIndex--
    ) {
      const codeUnit = source.charCodeAt(charIndex);

      if (
        codeUnit === 0x20 ||
        codeUnit === 0x09 ||
        codeUnit === 0x0a ||
        codeUnit === 0x0d
      )
        continue;

      lastContentChar = charIndex;
      break;
    }

    extents[lineIndex] = [firstContentChar, lastContentChar];
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
