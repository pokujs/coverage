import type { Node } from 'acorn';

const SKIP_KEYS: ReadonlySet<string> = new Set([
  'type',
  'start',
  'end',
  'loc',
  'range',
]);

const isNodeLike = (candidate: unknown): candidate is Node => {
  if (candidate === null || typeof candidate !== 'object') return false;

  const typed: { type?: unknown; start?: unknown } = candidate;

  return typeof typed.type === 'string' && typeof typed.start === 'number';
};

const isBranchNode = (candidate: Node): boolean =>
  candidate.type === 'LogicalExpression' ||
  candidate.type === 'ConditionalExpression' ||
  candidate.type === 'AssignmentPattern' ||
  candidate.type === 'IfStatement' ||
  candidate.type === 'SwitchStatement';

const forEachNode = (root: Node, visitor: (current: Node) => void): void => {
  const walkNode = (currentNode: Node): void => {
    visitor(currentNode);

    for (const propertyKey of Object.keys(currentNode)) {
      if (SKIP_KEYS.has(propertyKey)) continue;

      const propertyValue: unknown = Reflect.get(currentNode, propertyKey);
      if (propertyValue === null || propertyValue === undefined) continue;

      if (Array.isArray(propertyValue)) {
        for (const childCandidate of propertyValue) {
          if (isNodeLike(childCandidate)) walkNode(childCandidate);
        }

        continue;
      }

      if (isNodeLike(propertyValue)) walkNode(propertyValue);
    }
  };

  walkNode(root);
};

export const astWalk = {
  isBranchNode,
  isNodeLike,
  forEachNode,
} as const;
