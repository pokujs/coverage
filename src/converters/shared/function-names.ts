import type { Node } from 'acorn';
import type { FunctionLocation } from '../../@types/function-names.js';
import type { FileAggregation } from '../../@types/v8.js';
import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const FUNCTION_NODE_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const isFunctionNode = (node: Node): boolean =>
  FUNCTION_NODE_TYPES.has(node.type);

const readKeyName = (keyNode: Node | null): string => {
  if (keyNode === null) return '';

  if (keyNode.type === 'Identifier') {
    const identifierName: unknown = Reflect.get(keyNode, 'name');

    return typeof identifierName === 'string' ? identifierName : '';
  }

  if (keyNode.type === 'Literal') {
    const literalValue: unknown = Reflect.get(keyNode, 'value');

    if (typeof literalValue === 'string') return literalValue;
    if (typeof literalValue === 'number') return String(literalValue);
  }

  if (keyNode.type === 'PrivateIdentifier') {
    const privateName: unknown = Reflect.get(keyNode, 'name');

    return typeof privateName === 'string' ? `#${privateName}` : '';
  }

  return '';
};

const inferNameFromParent = (parent: Node, child: Node): string => {
  if (parent.type === 'VariableDeclarator') {
    const id = Reflect.get(parent, 'id') as Node | null;

    if (id !== null && id.type === 'Identifier') {
      const identifierName: unknown = Reflect.get(id, 'name');

      if (typeof identifierName === 'string') return identifierName;
    }

    return '';
  }

  if (parent.type === 'AssignmentExpression') {
    const left = Reflect.get(parent, 'left') as Node | null;
    if (left === null) return '';

    if (left.type === 'Identifier') {
      const identifierName: unknown = Reflect.get(left, 'name');
      if (typeof identifierName === 'string') return identifierName;
    }

    if (left.type === 'MemberExpression') {
      const property = Reflect.get(left, 'property') as Node | null;
      const propertyName = readKeyName(property);
      if (propertyName !== '') return propertyName;
    }

    return '';
  }

  if (parent.type === 'Property' || parent.type === 'PropertyDefinition') {
    const value = Reflect.get(parent, 'value') as Node | null;
    if (value !== child) return '';
    const key = Reflect.get(parent, 'key') as Node | null;
    return readKeyName(key);
  }

  if (parent.type === 'MethodDefinition') {
    const key = Reflect.get(parent, 'key') as Node | null;
    return readKeyName(key);
  }

  return '';
};

const collectFunctionLocations = (program: Node): FunctionLocation[] => {
  const locations: FunctionLocation[] = [];
  const parents: Node[] = [];

  const visit = (currentNode: Node): void => {
    if (isFunctionNode(currentNode) && parents.length > 0) {
      const parent = parents[parents.length - 1];
      const inferredName = inferNameFromParent(parent, currentNode);

      locations.push({
        startOffset: currentNode.start,
        endOffset: currentNode.end,
        inferredName,
      });
    }

    parents.push(currentNode);

    for (const propertyKey of Object.keys(currentNode)) {
      if (
        propertyKey === 'type' ||
        propertyKey === 'start' ||
        propertyKey === 'end' ||
        propertyKey === 'loc' ||
        propertyKey === 'range'
      )
        continue;

      const propertyValue: unknown = Reflect.get(currentNode, propertyKey);
      if (propertyValue === null || propertyValue === undefined) continue;

      if (Array.isArray(propertyValue)) {
        for (const childCandidate of propertyValue) {
          if (astWalk.isNodeLike(childCandidate)) visit(childCandidate);
        }

        continue;
      }

      if (astWalk.isNodeLike(propertyValue)) visit(propertyValue);
    }

    parents.pop();
  };

  visit(program);
  return locations;
};

const resolve = (aggregation: FileAggregation, source: string): void => {
  const program = astCache.parse(source);
  const locations = program === null ? null : collectFunctionLocations(program);

  for (const [functionKey, functionEntry] of aggregation.functions) {
    if (functionEntry.isModuleFunction) continue;
    if (functionEntry.name !== '') continue;

    if (locations !== null) {
      const match = locations.find(
        (location) =>
          location.startOffset === functionEntry.startOffset &&
          location.endOffset === functionEntry.endOffset
      );

      if (match !== undefined && match.inferredName !== '') {
        functionEntry.name = match.inferredName;
        continue;
      }
    }

    aggregation.functions.delete(functionKey);
  }
};

export const functionNames = {
  resolve,
} as const;
