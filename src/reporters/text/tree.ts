import type { Row } from '../../@types/text.js';
import type { TreeNode } from '../../@types/tree.js';
import { metrics } from '../shared/metrics.js';
import { ranges } from '../shared/ranges.js';
import { tree } from '../shared/tree.js';

export const buildTree = tree.build;

const buildFileRow = (decoratedName: string, child: TreeNode): Row => {
  if (!child.file)
    return { name: decoratedName, metrics: null, absolutePath: undefined };

  const fileLines = metrics.fromLineHits(child.file.lineHits);
  const positionalLines = new Set<number>();

  for (const position of child.file.uncoveredBranchPositions)
    positionalLines.add(position.line);
  for (const position of child.file.uncoveredFunctionPositions)
    positionalLines.add(position.line);

  const uncoveredLineNumbers = ranges
    .extractUncoveredLines(child.file.lineHits)
    .filter((lineNumber) => !positionalLines.has(lineNumber));

  const totalExecutable = child.file.lineHits.size;
  const uncoveredRanges =
    totalExecutable > 0 &&
    uncoveredLineNumbers.length === totalExecutable &&
    uncoveredLineNumbers.length > 0
      ? [
          {
            start: uncoveredLineNumbers[0],
            end: uncoveredLineNumbers[uncoveredLineNumbers.length - 1],
          },
        ]
      : ranges.collapseRanges(uncoveredLineNumbers);

  return {
    name: decoratedName,
    absolutePath: child.file.file,
    metrics: {
      statements: fileLines,
      branches: child.file.branches,
      functions: child.file.functions,
      lines: fileLines,
      uncoveredRanges,
      uncoveredBranchPositions: child.file.uncoveredBranchPositions,
      uncoveredFunctionPositions: child.file.uncoveredFunctionPositions,
    },
  };
};

const buildDirectoryRow = (decoratedName: string, child: TreeNode): Row => {
  const descendantFiles = tree.collectFiles(child);
  const descendantLines = metrics.aggregateLines(descendantFiles);

  return {
    name: decoratedName,
    metrics: {
      statements: descendantLines,
      branches: metrics.aggregateBy(
        descendantFiles,
        (fileCoverage) => fileCoverage.branches
      ),
      functions: metrics.aggregateBy(
        descendantFiles,
        (fileCoverage) => fileCoverage.functions
      ),
      lines: descendantLines,
      uncoveredRanges: [],
      uncoveredBranchPositions: [],
      uncoveredFunctionPositions: [],
    },
  };
};

export const walkTree = (node: TreeNode, rows: Row[]): void => {
  tree.walk(node, (child, context) => {
    rows.push(
      child.isFile && child.file
        ? buildFileRow(context.decoratedName, child)
        : buildDirectoryRow(context.decoratedName, child)
    );
  });
};
