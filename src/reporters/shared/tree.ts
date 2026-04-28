import type { PathTreeWalkContext } from '../../@types/path-tree.js';
import type {
  CoverageModel,
  FileCoverage,
  TreeNode,
} from '../../@types/tree.js';
import { pathTree } from './path-tree.js';

const build = (model: CoverageModel, cwd: string): TreeNode => {
  const root = pathTree.build<FileCoverage>(
    model,
    (fileCoverage) => fileCoverage.file,
    cwd
  );

  return adaptNode(root);
};

const adaptNode = (
  node: ReturnType<typeof pathTree.build<FileCoverage>>
): TreeNode => ({
  segment: node.segment,
  isFile: node.isFile,
  children: node.children.map(adaptNode),
  file: node.payload,
});

const collectFiles = (node: TreeNode): FileCoverage[] => {
  if (node.isFile && node.file) return [node.file];
  return node.children.flatMap((child) => collectFiles(child));
};

const walk = (
  root: TreeNode,
  visitor: (child: TreeNode, context: PathTreeWalkContext) => void
): void => {
  walkChildren(root, '', 0, visitor);
};

const walkChildren = (
  node: TreeNode,
  prefix: string,
  depth: number,
  visitor: (child: TreeNode, context: PathTreeWalkContext) => void
): void => {
  const total = node.children.length;

  for (let childIndex = 0; childIndex < total; childIndex++) {
    const child = node.children[childIndex];
    const isLast = childIndex === total - 1;
    let decoratedName: string;

    if (depth === 0) {
      decoratedName = child.segment;
    } else {
      const connector = isLast ? '└ ' : '├ ';

      decoratedName = prefix + connector + child.segment;
    }

    visitor(child, { depth, prefix, isLast, decoratedName });

    if (child.children.length > 0) {
      const nextPrefix = depth === 0 ? '' : prefix + (isLast ? '  ' : '│ ');

      walkChildren(child, nextPrefix, depth + 1, visitor);
    }
  }
};

export const tree = { build, collectFiles, walk } as const;
