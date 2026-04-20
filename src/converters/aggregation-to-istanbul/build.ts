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
import { istanbulEntries } from '../shared/istanbul-entries.js';

const buildStatements = (
  covSource: CovSource,
  aggregation: FileAggregation
): StatementCoverageSlice => {
  const statementMap: StatementMap = Object.create(null);
  const s: StatementCounts = Object.create(null);

  for (const covLine of covSource.lines) {
    const key = String(covLine.line - 1);
    const hits = aggregation.lineHits.get(covLine.line);

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
  aggregation: FileAggregation
): FunctionCoverageSlice => {
  const fnMap: FnMap = Object.create(null);
  const f: FunctionCounts = Object.create(null);

  const userFunctions = Array.from(aggregation.functions.values())
    .filter((functionEntry) => !functionEntry.isModuleFunction)
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
  aggregation: FileAggregation
): BranchCoverageSlice => {
  const branchMap: BranchMap = Object.create(null);
  const b: BranchCounts = Object.create(null);

  const branchFunctions = Array.from(aggregation.functions.values())
    .filter(
      (functionEntry) =>
        functionEntry.isBlockCoverage && functionEntry.blocks.length > 0
    )
    .sort((left, right) => left.line - right.line);

  let branchIndex = 0;

  for (const functionEntry of branchFunctions) {
    const sortedBlocks = [...functionEntry.blocks].sort(
      (left, right) => left.order - right.order
    );

    for (const block of sortedBlocks) {
      const armLines = block.arms
        .map((arm) => findLineForLocation(covSource, arm.line))
        .filter((lineInfo): lineInfo is CovLine => lineInfo !== undefined);
      if (armLines.length === 0) continue;

      const firstArmLine = armLines[0];
      const covBranch = istanbulEntries.createCovBranch(
        firstArmLine.line,
        0,
        firstArmLine.line,
        firstArmLine.endColumn - firstArmLine.startColumn,
        block.arms[0]?.takenCount ?? 0
      );
      const baseEntry = istanbulEntries.covBranchToBranchMapEntry(covBranch);

      baseEntry.locations = block.arms.map((arm) => {
        const lineInfo = findLineForLocation(covSource, arm.line);

        if (lineInfo === undefined) {
          return {
            start: { line: arm.line, column: 0 },
            end: { line: arm.line, column: 0 },
          };
        }

        return {
          start: { line: arm.line, column: 0 },
          end: {
            line: arm.line,
            column: lineInfo.endColumn - lineInfo.startColumn,
          },
        };
      });

      const key = String(branchIndex++);

      branchMap[key] = baseEntry;
      b[key] = block.arms.map((arm) => arm.takenCount);
    }
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
  const { fnMap, f } = buildFunctions(covSource, aggregation);
  const { branchMap, b } = buildBranches(covSource, aggregation);

  return { path: filePath, statementMap, s, fnMap, f, branchMap, b };
};

export const build = { fromAggregation } as const;
