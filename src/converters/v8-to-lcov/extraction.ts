import type { FileAggregation, V8ScriptCoverage } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';

export const computeLineHits = (
  source: string,
  script: V8ScriptCoverage
): Map<number, number> => {
  const lineCounts = new Map<number, number>();
  const lineRangeSize = new Map<number, number>();
  const lineStartTable = offsets.lineStarts(source);
  const totalLines = source.split('\n').length;

  for (const scriptFunction of script.functions) {
    for (const range of scriptFunction.ranges) {
      if (range.endOffset <= range.startOffset) continue;

      const [firstLine, lastLine] = offsets.rangeLines(
        range.startOffset,
        range.endOffset,
        lineStartTable
      );

      const size = range.endOffset - range.startOffset;

      for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
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
    if (lineNumber < 1 || lineNumber > totalLines) continue;
    result.set(lineNumber, count);
  }

  const moduleFunction = script.functions.find(
    (scriptFunction) => scriptFunction.functionName === ''
  );
  const moduleCount = moduleFunction?.ranges[0]?.count ?? 0;

  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
    if (!result.has(lineNumber)) result.set(lineNumber, moduleCount);
  }

  return result;
};

export const absorbFunctions = (
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
        blocks: [],
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
