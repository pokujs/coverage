import type {
  CoverageModel,
  FileCoverage,
  TreeNode,
} from '../../@types/tree.js';
import { paths } from '../../utils/paths.js';

export const buildTree = (model: CoverageModel, cwd: string): TreeNode => {
  const root: TreeNode = { segment: '', isFile: false, children: [] };

  for (const fileCoverage of model) {
    const relativePath = paths.relativize(fileCoverage.file, cwd);
    const parts = paths
      .toPosix(relativePath)
      .split('/')
      .filter((part) => part.length > 0);

    if (parts.length === 0) continue;

    let current = root;

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      const isLeaf = partIndex === parts.length - 1;

      let child = current.children.find((node) => node.segment === part);

      if (!child) {
        child = {
          segment: part,
          isFile: isLeaf,
          children: [],
        };

        if (isLeaf) child.file = fileCoverage;
        current.children.push(child);
      }

      current = child;
    }
  }

  sortTree(root);
  return root;
};

const sortTree = (node: TreeNode): void => {
  node.children.sort((left, right) => {
    if (left.isFile !== right.isFile) return left.isFile ? 1 : -1;
    return left.segment.localeCompare(right.segment);
  });

  for (const child of node.children) sortTree(child);
};

export const collectFileCoverages = (node: TreeNode): FileCoverage[] => {
  if (node.isFile && node.file) return [node.file];
  return node.children.flatMap((child) => collectFileCoverages(child));
};
