import type { Node } from 'acorn';
import type { TypedNode } from '../../@types/acorn-nodes.js';
import type { FunctionLocation } from '../../@types/function-names.js';
import type { FileAggregation } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { astCache } from './ast-cache.js';

const SKIP_KEYS: ReadonlySet<string> = new Set([
  'type',
  'start',
  'end',
  'loc',
  'range',
]);

const FUNCTION_NODE_TYPES: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

const isFunctionNode = (node: Node): boolean =>
  FUNCTION_NODE_TYPES.has(node.type);

const isNode = (candidate: unknown): candidate is Node =>
  candidate !== null &&
  typeof candidate === 'object' &&
  typeof (candidate as { type?: unknown }).type === 'string';

const readKeyName = (keyNode: Node): string => {
  const typed = keyNode as TypedNode;

  if (typed.type === 'Identifier') return typed.name;

  if (typed.type === 'Literal') {
    if (typeof typed.value === 'string') return typed.value;
    if (typeof typed.value === 'number') return String(typed.value);
    return '';
  }

  if (typed.type === 'PrivateIdentifier') return `#${typed.name}`;

  return '';
};

const inferNameFromParent = (parent: Node, child: Node): string => {
  const typedParent = parent as TypedNode;

  if (typedParent.type === 'VariableDeclarator') {
    const id = typedParent.id as TypedNode;
    if (id.type === 'Identifier') return id.name;
    return '';
  }

  if (typedParent.type === 'AssignmentExpression') {
    const left = typedParent.left as TypedNode;
    if (left.type === 'Identifier') return left.name;
    if (left.type === 'MemberExpression') return readKeyName(left.property);
    return '';
  }

  if (typedParent.type === 'Property') {
    if (typedParent.value !== child) return '';
    return readKeyName(typedParent.key);
  }

  if (typedParent.type === 'PropertyDefinition') {
    if (typedParent.value !== child) return '';
    return readKeyName(typedParent.key);
  }

  if (typedParent.type === 'MethodDefinition') {
    return readKeyName(typedParent.key);
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
      if (SKIP_KEYS.has(propertyKey)) continue;

      const propertyValue = Reflect.get(currentNode, propertyKey);
      if (propertyValue === null || propertyValue === undefined) continue;

      if (Array.isArray(propertyValue)) {
        for (const child of propertyValue) {
          if (isNode(child)) visit(child);
        }

        continue;
      }

      if (isNode(propertyValue)) visit(propertyValue);
    }

    parents.pop();
  };

  visit(program);
  return locations;
};

const resolve = (aggregation: FileAggregation, source: string): void => {
  const program = astCache.parse(source);
  const locations = program === null ? null : collectFunctionLocations(program);
  const lineStartTable = offsets.lineStarts(source);

  for (const functionEntry of aggregation.functions.values()) {
    if (functionEntry.isModuleFunction) continue;
    if (functionEntry.name !== '') continue;
    if (locations === null) continue;

    const match = locations.find(
      (location) =>
        location.startOffset === functionEntry.startOffset &&
        location.endOffset === functionEntry.endOffset
    );

    if (match !== undefined && match.inferredName !== '')
      functionEntry.name = match.inferredName;
  }

  for (const functionEntry of aggregation.functions.values()) {
    if (functionEntry.isModuleFunction) continue;
    if (functionEntry.name !== '') continue;
    if (locations === null) continue;

    const match = locations.find(
      (location) =>
        location.startOffset >= functionEntry.startOffset &&
        location.endOffset <= functionEntry.endOffset
    );
    if (match === undefined) continue;

    const location = offsets.toLocation(match.startOffset, lineStartTable);

    functionEntry.line = location.line;
    functionEntry.column = location.column;
    functionEntry.startOffset = match.startOffset;
    functionEntry.endOffset = match.endOffset;

    if (match.inferredName !== '') functionEntry.name = match.inferredName;
  }

  const anonymousEntries = Array.from(aggregation.functions.values())
    .filter(
      (functionEntry) =>
        !functionEntry.isModuleFunction && functionEntry.name === ''
    )
    .sort((left, right) => left.startOffset - right.startOffset);

  for (
    let anonymousIndex = 0;
    anonymousIndex < anonymousEntries.length;
    anonymousIndex++
  ) {
    anonymousEntries[anonymousIndex].name = `(anonymous_${anonymousIndex + 1})`;
  }
};

export const functionNames = {
  resolve,
} as const;
