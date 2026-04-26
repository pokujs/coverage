import type { Node } from 'acorn';

const SKIP_KEYS: ReadonlySet<string> = new Set([
  'type',
  'start',
  'end',
  'loc',
  'range',
]);

const isBranchNode = (candidate: Node): boolean =>
  candidate.type === 'LogicalExpression' ||
  candidate.type === 'ConditionalExpression' ||
  candidate.type === 'AssignmentPattern' ||
  candidate.type === 'IfStatement' ||
  candidate.type === 'SwitchStatement';

const isFunctionNode = (candidate: Node): boolean =>
  candidate.type === 'FunctionDeclaration' ||
  candidate.type === 'FunctionExpression' ||
  candidate.type === 'ArrowFunctionExpression';

const isNode = (candidate: unknown): candidate is Node =>
  candidate !== null &&
  typeof candidate === 'object' &&
  typeof (candidate as { type?: unknown }).type === 'string';

const forEachNode = (root: Node, visitor: (current: Node) => void): void => {
  const walk = (currentNode: Node): void => {
    visitor(currentNode);

    for (const propertyKey of Object.keys(currentNode)) {
      if (SKIP_KEYS.has(propertyKey)) continue;

      const propertyValue = Reflect.get(currentNode, propertyKey);
      if (propertyValue === null || propertyValue === undefined) continue;

      if (Array.isArray(propertyValue)) {
        for (const child of propertyValue) {
          if (isNode(child)) walk(child);
        }

        continue;
      }

      if (isNode(propertyValue)) walk(propertyValue);
    }
  };

  walk(root);
};

export const astWalk = {
  isBranchNode,
  isFunctionNode,
  forEachNode,
} as const;
