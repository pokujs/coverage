import type { Row } from '../../@types/text.js';
import type { TreeNode } from '../../@types/tree.js';
import { metrics } from '../shared/metrics.js';
import { tree } from '../shared/tree.js';
import { collapseRanges, extractUncoveredLines } from './ranges.js';

export const buildTree = tree.build;

export const walkTree = (
  node: TreeNode,
  prefix: string,
  depth: number,
  rows: Row[]
): void => {
  const total = node.children.length;

  for (let childIndex = 0; childIndex < total; childIndex++) {
    const child = node.children[childIndex];
    const isLast = childIndex === total - 1;

    let name: string;

    if (depth === 0) {
      name = child.segment;
    } else {
      const connector = isLast ? '└ ' : '├ ';

      name = prefix + connector + child.segment;
    }

    if (child.isFile && child.file) {
      const fileLines = metrics.fromLineHits(child.file.lineHits);
      const positionalLines = new Set<number>();

      for (const position of child.file.uncoveredBranchPositions)
        positionalLines.add(position.line);
      for (const position of child.file.uncoveredFunctionPositions)
        positionalLines.add(position.line);

      const uncoveredLineNumbers = extractUncoveredLines(
        child.file.lineHits
      ).filter((lineNumber) => !positionalLines.has(lineNumber));

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
          : collapseRanges(uncoveredLineNumbers);

      rows.push({
        name,
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
      });
    } else {
      const descendantFiles = tree.collectFiles(child);
      const descendantLines = metrics.aggregateLines(descendantFiles);

      rows.push({
        name,
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
      });
    }

    if (child.children.length > 0) {
      let nextPrefix: string;

      if (depth === 0) {
        nextPrefix = '';
      } else {
        nextPrefix = prefix + (isLast ? '  ' : '│ ');
      }

      walkTree(child, nextPrefix, depth + 1, rows);
    }
  }
};
