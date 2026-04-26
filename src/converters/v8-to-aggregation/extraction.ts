import type { FileAggregation, V8ScriptCoverage } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { sourceLines } from '../../utils/source-lines.js';
import { nonExecutableLines } from '../shared/non-executable-lines.js';

const computeLineHits = (
  source: string,
  script: V8ScriptCoverage
): Map<number, number> => {
  const lineStartTable = offsets.lineStarts(source);
  const contentExtents = offsets.lineContentExtents(source, lineStartTable);
  const commentOnlyLines = sourceLines.findCommentOnlyLines(source);
  const delimiterOnlyLines = sourceLines.findDelimiterOnlyLines(source);
  const syntacticallyNonExecutableLines = nonExecutableLines.find(source);
  const totalLines = source.split('\n').length;
  const lineCounts = new Map<number, number>();
  const lineRangeSize = new Map<number, number>();
  const zeroWidthHitMarkers = new Map<number, number>();
  const linesPartiallyZero = new Set<number>();

  for (const scriptFunction of script.functions) {
    for (const range of scriptFunction.ranges) {
      if (range.endOffset === range.startOffset) {
        if (range.count <= 0) continue;

        const markerLocation = offsets.toLocation(
          range.startOffset,
          lineStartTable
        );
        const markerLine = markerLocation.line;

        if (markerLine < 1 || markerLine > totalLines) continue;

        const previousMarker = zeroWidthHitMarkers.get(markerLine) ?? 0;
        if (range.count > previousMarker)
          zeroWidthHitMarkers.set(markerLine, range.count);

        continue;
      }

      if (range.endOffset < range.startOffset) continue;

      const [firstLine, lastLine] = offsets.rangeLines(
        range.startOffset,
        range.endOffset,
        lineStartTable
      );

      if (range.count === 0) {
        for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
          if (lineNumber < 1 || lineNumber > totalLines) continue;
          if (contentExtents[lineNumber - 1] === null) continue;
          linesPartiallyZero.add(lineNumber);
        }
      }

      const size = range.endOffset - range.startOffset;

      for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
        if (lineNumber < 1 || lineNumber > totalLines) continue;

        const extent = contentExtents[lineNumber - 1];
        if (extent === null) continue;

        const [firstContentByte, lastContentByte] = extent;

        if (
          range.startOffset > firstContentByte ||
          range.endOffset <= lastContentByte
        )
          continue;

        const existing = lineRangeSize.get(lineNumber);

        if (existing === undefined || size < existing) {
          lineRangeSize.set(lineNumber, size);
          lineCounts.set(lineNumber, range.count);
        }
      }
    }
  }

  const result = new Map<number, number>();

  for (const [lineNumber, count] of lineCounts) {
    result.set(lineNumber, count);
  }

  for (const [lineNumber, markerCount] of zeroWidthHitMarkers) {
    const existing = result.get(lineNumber);
    if (existing === undefined || existing === 0)
      result.set(lineNumber, markerCount);
  }

  const moduleFunction = script.functions.find(
    (scriptFunction) => scriptFunction.functionName === ''
  );
  const moduleCount = moduleFunction?.ranges[0]?.count ?? 0;

  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
    if (contentExtents[lineNumber - 1] === null) {
      result.delete(lineNumber);
      continue;
    }

    if (commentOnlyLines.has(lineNumber)) {
      result.delete(lineNumber);
      continue;
    }

    if (delimiterOnlyLines.has(lineNumber)) {
      result.delete(lineNumber);
      continue;
    }

    if (syntacticallyNonExecutableLines.has(lineNumber)) {
      result.delete(lineNumber);
      continue;
    }

    if (!result.has(lineNumber)) {
      result.set(
        lineNumber,
        linesPartiallyZero.has(lineNumber) ? 0 : moduleCount
      );
    }
  }

  return result;
};

const absorbFunctions = (
  fileAggregation: FileAggregation,
  script: V8ScriptCoverage,
  lineStarts: number[],
  sourceLength: number
): void => {
  for (const scriptFunction of script.functions) {
    if (scriptFunction.ranges.length === 0) continue;

    const outerRange = scriptFunction.ranges[0];
    const functionKey = `${outerRange.startOffset}-${outerRange.endOffset}`;

    let functionEntry = fileAggregation.functions.get(functionKey);

    if (!functionEntry) {
      const location = offsets.toLocation(outerRange.startOffset, lineStarts);
      const isModuleFunction =
        scriptFunction.functionName === '' &&
        outerRange.startOffset === 0 &&
        outerRange.endOffset === sourceLength;

      functionEntry = {
        line: location.line,
        column: location.column,
        name: scriptFunction.functionName,
        startOffset: outerRange.startOffset,
        endOffset: outerRange.endOffset,
        outerCount: 0,
        isBlockCoverage: scriptFunction.isBlockCoverage,
        isModuleFunction,
        subRanges: new Map(),
      };

      fileAggregation.functions.set(functionKey, functionEntry);
    } else if (
      functionEntry.name === '' &&
      scriptFunction.functionName !== ''
    ) {
      functionEntry.name = scriptFunction.functionName;
    }

    functionEntry.outerCount += outerRange.count;

    for (
      let rangeIndex = 1;
      rangeIndex < scriptFunction.ranges.length;
      rangeIndex++
    ) {
      const subRange = scriptFunction.ranges[rangeIndex];
      const subKey = `${subRange.startOffset}-${subRange.endOffset}`;

      let subRangeEntry = functionEntry.subRanges.get(subKey);
      if (!subRangeEntry) {
        const [subLine] = offsets.rangeLines(
          subRange.startOffset,
          subRange.endOffset,
          lineStarts
        );

        subRangeEntry = {
          line: subLine,
          startOffset: subRange.startOffset,
          endOffset: subRange.endOffset,
          takenCount: 0,
          indexInFunction: rangeIndex - 1,
        };

        functionEntry.subRanges.set(subKey, subRangeEntry);
      }

      subRangeEntry.takenCount += subRange.count;
    }
  }
};

export const v8Extraction = { computeLineHits, absorbFunctions } as const;
