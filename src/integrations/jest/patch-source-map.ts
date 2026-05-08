import type { SourceMapSegment } from '../../@types/source-map.js';
import type { V8Function } from '../../@types/v8.js';
import { encodeMappings } from '../../utils/source-map/vlq-encode.js';
import { decodeMappings } from '../../utils/source-map/vlq.js';

const FUNCTION_KEYWORD = 'function';

const offsetToLineColumn = (
  offset: number,
  lineLengths: readonly number[]
): { line: number; column: number } => {
  let cursor = 0;
  for (let lineIndex = 0; lineIndex < lineLengths.length; lineIndex++) {
    const lineLength = lineLengths[lineIndex];
    const lineEnd = cursor + lineLength;
    if (offset <= lineEnd) return { line: lineIndex, column: offset - cursor };
    cursor = lineEnd + 1;
  }
  return { line: lineLengths.length - 1, column: 0 };
};

const findPreviousFullSegment = (
  lineSegments: SourceMapSegment[],
  column: number
): [number, number, number, number] | undefined => {
  for (
    let segmentIndex = lineSegments.length - 1;
    segmentIndex >= 0;
    segmentIndex--
  ) {
    const segment = lineSegments[segmentIndex];
    if (segment[0] >= column) continue;
    if (segment.length >= 4) {
      const [
        previousGeneratedColumn,
        sourceIndex,
        sourceLine,
        previousSourceColumn,
      ] = segment;
      if (
        sourceIndex === undefined ||
        sourceLine === undefined ||
        previousSourceColumn === undefined
      )
        continue;
      return [
        previousGeneratedColumn,
        sourceIndex,
        sourceLine,
        previousSourceColumn,
      ];
    }
  }
  return undefined;
};

const insertSorted = (
  lineSegments: SourceMapSegment[],
  segment: SourceMapSegment
): void => {
  for (
    let segmentIndex = 0;
    segmentIndex < lineSegments.length;
    segmentIndex++
  ) {
    if (lineSegments[segmentIndex][0] > segment[0]) {
      lineSegments.splice(segmentIndex, 0, segment);
      return;
    }
  }
  lineSegments.push(segment);
};

const apply = (
  sourceMap: { mappings: string },
  transpiledCode: string,
  transpiledLineLengths: readonly number[],
  functions: readonly V8Function[]
): void => {
  const decoded: SourceMapSegment[][] = decodeMappings(sourceMap.mappings);
  let mutated = false;

  for (const scriptFunction of functions) {
    if (scriptFunction.functionName === '') continue;
    if (scriptFunction.ranges.length === 0) continue;

    const startOffset = scriptFunction.ranges[0].startOffset;
    if (
      transpiledCode.slice(
        startOffset,
        startOffset + FUNCTION_KEYWORD.length
      ) !== FUNCTION_KEYWORD
    )
      continue;

    const { line, column } = offsetToLineColumn(
      startOffset,
      transpiledLineLengths
    );

    const lineSegments = decoded[line];
    if (lineSegments === undefined) continue;
    if (lineSegments.some((segment) => segment[0] === column)) continue;

    const previousSegment = findPreviousFullSegment(lineSegments, column);
    if (previousSegment === undefined) continue;

    const [
      previousGeneratedColumn,
      sourceIndex,
      sourceLine,
      previousSourceColumn,
    ] = previousSegment;
    const synthesizedSegment: SourceMapSegment = [
      column,
      sourceIndex,
      sourceLine,
      previousSourceColumn + (column - previousGeneratedColumn),
    ];

    insertSorted(lineSegments, synthesizedSegment);
    mutated = true;
  }

  if (mutated) sourceMap.mappings = encodeMappings(decoded);
};

export const tsCompilerSourceMapPatch = { apply } as const;
