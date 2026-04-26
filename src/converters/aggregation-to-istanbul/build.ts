import type {
  BranchCounts,
  BranchCoverageSlice,
  BranchMap,
  CovLine,
  CovSource,
  FileCoverage,
  FnMap,
  FunctionCounts,
  FunctionCoverageSlice,
  StatementCounts,
  StatementCoverageSlice,
  StatementMap,
} from '../../@types/istanbul.js';
import type { FileAggregation } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { functionPositions } from '../shared/function-positions.js';
import { istanbulEntries } from '../shared/istanbul-entries.js';

const buildStatements = (
  covSource: CovSource,
  aggregation: FileAggregation
): StatementCoverageSlice => {
  const statementMap: StatementMap = Object.create(null);
  const s: StatementCounts = Object.create(null);

  for (const covLine of covSource.lines) {
    const hits = aggregation.lineHits.get(covLine.line);
    if (hits === undefined && !covLine.ignore) continue;

    const key = String(covLine.line - 1);

    statementMap[key] = istanbulEntries.covLineToStatementMapEntry(covLine);
    s[key] = covLine.ignore ? 1 : (hits ?? 0);
  }

  return { statementMap, s };
};

const findLineForLocation = (
  covSource: CovSource,
  lineNumber: number
): CovLine | undefined => covSource.lines[lineNumber - 1];

const buildFunctions = (
  covSource: CovSource,
  aggregation: FileAggregation,
  sourceText: string
): FunctionCoverageSlice => {
  const fnMap: FnMap = Object.create(null);
  const f: FunctionCounts = Object.create(null);

  const validPositions = functionPositions.collect(sourceText);

  const userFunctions = Array.from(aggregation.functions.values())
    .filter((functionEntry) => !functionEntry.isModuleFunction)
    .filter((functionEntry) =>
      validPositions.has(`${functionEntry.line}:${functionEntry.column}`)
    )
    .sort((left, right) => left.line - right.line);

  userFunctions.forEach((functionEntry, functionIndex) => {
    const key = String(functionIndex);

    const startLineInfo = findLineForLocation(covSource, functionEntry.line);
    if (startLineInfo === undefined) return;

    const covFunction = istanbulEntries.createCovFunction(
      functionEntry.name,
      functionEntry.line,
      functionEntry.column,
      functionEntry.line,
      startLineInfo.endColumn - startLineInfo.startColumn,
      functionEntry.outerCount
    );

    fnMap[key] = istanbulEntries.covFunctionToFnMapEntry(covFunction);
    f[key] = functionEntry.outerCount;
  });

  return { fnMap, f };
};

const buildBranches = (
  covSource: CovSource,
  aggregation: FileAggregation,
  sourceText: string
): BranchCoverageSlice => {
  const branchMap: BranchMap = Object.create(null);
  const b: BranchCounts = Object.create(null);

  const sortedBlocks = [...aggregation.blocks].sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return left.startOffset - right.startOffset;
  });

  const lineStartTable = offsets.lineStarts(sourceText);

  let branchIndex = 0;

  for (const block of sortedBlocks) {
    const armLines = block.arms
      .map((arm) => findLineForLocation(covSource, arm.line))
      .filter((lineInfo): lineInfo is CovLine => lineInfo !== undefined);
    if (armLines.length === 0) continue;

    const nodeStartLocation = offsets.toLocation(
      block.startOffset,
      lineStartTable
    );
    const nodeEndLocation = offsets.toLocation(block.endOffset, lineStartTable);

    const covBranch = istanbulEntries.createCovBranch(
      nodeStartLocation.line,
      nodeStartLocation.column,
      nodeEndLocation.line,
      nodeEndLocation.column,
      block.arms[0]?.takenCount ?? 0
    );
    const baseEntry = istanbulEntries.covBranchToBranchMapEntry(covBranch);

    baseEntry.locations = block.arms.map((arm) => {
      const startLocation = offsets.toLocation(arm.startOffset, lineStartTable);
      const endLocation = offsets.toLocation(arm.endOffset, lineStartTable);

      return {
        start: { line: startLocation.line, column: startLocation.column },
        end: { line: endLocation.line, column: endLocation.column },
      };
    });

    const key = String(branchIndex++);

    branchMap[key] = baseEntry;
    b[key] = block.arms.map((arm) => arm.takenCount);
  }

  return { branchMap, b };
};

const fromAggregation = (
  filePath: string,
  aggregation: FileAggregation,
  sourceText: string
): FileCoverage => {
  const covSource = istanbulEntries.createCovSource(sourceText, 0);
  const { statementMap, s } = buildStatements(covSource, aggregation);
  const { fnMap, f } = buildFunctions(covSource, aggregation, sourceText);
  const { branchMap, b } = buildBranches(covSource, aggregation, sourceText);

  return { path: filePath, statementMap, s, fnMap, f, branchMap, b };
};

export const build = { fromAggregation } as const;
