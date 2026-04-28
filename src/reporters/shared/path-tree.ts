import type { PathTreeNode, PathTreeVisitor } from '../../@types/path-tree.js';
import { paths } from '../../utils/paths.js';

const sortNode = <TPayload>(node: PathTreeNode<TPayload>): void => {
  node.children.sort((left, right) => {
    if (left.isFile !== right.isFile) return left.isFile ? 1 : -1;
    return left.segment.localeCompare(right.segment);
  });

  for (const child of node.children) sortNode(child);
};

const build = <TPayload>(
  items: readonly TPayload[],
  getAbsolutePath: (payload: TPayload) => string,
  cwd: string
): PathTreeNode<TPayload> => {
  const root: PathTreeNode<TPayload> = {
    segment: '',
    isFile: false,
    children: [],
  };

  for (const item of items) {
    const absolutePath = getAbsolutePath(item);
    const relativePath = paths.relativize(absolutePath, cwd);
    const segments = paths
      .toPosix(relativePath)
      .split('/')
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) continue;

    let current = root;

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      const isLeaf = segmentIndex === segments.length - 1;

      let child = current.children.find((node) => node.segment === segment);

      if (!child) {
        child = { segment, isFile: isLeaf, children: [] };

        if (isLeaf) child.payload = item;

        current.children.push(child);
      }

      current = child;
    }
  }

  sortNode(root);
  return root;
};

const collectPayloads = <TPayload>(
  node: PathTreeNode<TPayload>
): TPayload[] => {
  if (node.isFile && node.payload !== undefined) return [node.payload];
  return node.children.flatMap((child) => collectPayloads(child));
};

const walkChildren = <TPayload>(
  node: PathTreeNode<TPayload>,
  prefix: string,
  depth: number,
  visitor: PathTreeVisitor<TPayload>
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

const walk = <TPayload>(
  root: PathTreeNode<TPayload>,
  visitor: PathTreeVisitor<TPayload>
): void => {
  walkChildren(root, '', 0, visitor);
};

export const pathTree = { build, walk, collectPayloads } as const;
