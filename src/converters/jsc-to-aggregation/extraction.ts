import type { Node } from 'acorn';
import type {
  JscBasicBlock,
  JscFunctionContainer,
  JscScriptBlocks,
} from '../../@types/jsc.js';
import type { FileAggregation } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { astWalk } from '../shared/ast-walk.js';

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

const inferName = (parent: Node | undefined, functionNode: Node): string => {
  const ownId = Reflect.get(functionNode, 'id') as Node | null;

  if (ownId !== null && ownId.type === 'Identifier') {
    const identifierName: unknown = Reflect.get(ownId, 'name');

    if (typeof identifierName === 'string') return identifierName;
  }

  if (parent === undefined) return '';

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
    if (value !== functionNode) return '';

    const key = Reflect.get(parent, 'key') as Node | null;

    return readKeyName(key);
  }

  if (parent.type === 'MethodDefinition') {
    const key = Reflect.get(parent, 'key') as Node | null;

    return readKeyName(key);
  }

  return '';
};

const collectFunctionContainers = (
  program: Node,
  sourceLength: number
): JscFunctionContainer[] => {
  const containers: JscFunctionContainer[] = [
    {
      nodeStart: 0,
      nodeEnd: sourceLength,
      bodyStart: 0,
      bodyEnd: sourceLength,
      name: '',
      isModuleFunction: true,
    },
  ];
  const ancestors: Node[] = [];

  const visit = (currentNode: Node): void => {
    if (isFunctionNode(currentNode)) {
      const parent =
        ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
      const body = Reflect.get(currentNode, 'body') as Node | null;
      const bodyStart = body !== null ? body.start : currentNode.start;
      const bodyEnd = body !== null ? body.end : currentNode.end;

      containers.push({
        nodeStart: currentNode.start,
        nodeEnd: currentNode.end,
        bodyStart,
        bodyEnd,
        name: inferName(parent, currentNode),
        isModuleFunction: false,
      });
    }

    ancestors.push(currentNode);

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

    ancestors.pop();
  };

  visit(program);
  return containers;
};

const findOwnerContainer = (
  containers: readonly JscFunctionContainer[],
  block: JscBasicBlock
): JscFunctionContainer => {
  let bestContainer = containers[0];
  let bestSpan = bestContainer.nodeEnd - bestContainer.nodeStart;

  for (const container of containers) {
    if (container.isModuleFunction) continue;
    if (block.startOffset < container.nodeStart) continue;
    if (block.endOffset > container.nodeEnd) continue;

    const span = container.nodeEnd - container.nodeStart;

    if (span < bestSpan) {
      bestContainer = container;
      bestSpan = span;
    }
  }

  return bestContainer;
};

const resolveModuleCount = (
  container: JscFunctionContainer,
  blocks: readonly JscBasicBlock[]
): number => {
  let outerCount: number | undefined;
  let outerSpan = -1;
  let maxExecutionCount = 0;

  for (const block of blocks) {
    if (block.startOffset < container.nodeStart) continue;
    if (block.endOffset > container.nodeEnd) continue;

    const span = block.endOffset - block.startOffset;
    if (span <= 0) continue;

    if (span > outerSpan) {
      outerCount = block.executionCount;
      outerSpan = span;
    }

    if (block.executionCount > maxExecutionCount) {
      maxExecutionCount = block.executionCount;
    }
  }

  if (outerCount !== undefined && outerCount > 0) return outerCount;
  return maxExecutionCount;
};

const resolveBodyCount = (
  container: JscFunctionContainer,
  blocks: readonly JscBasicBlock[]
): number => {
  if (container.isModuleFunction) return resolveModuleCount(container, blocks);

  let bodyCount: number | undefined;
  let bestBodySpan = -1;
  let maxExecutionCount = 0;

  for (const block of blocks) {
    if (block.startOffset < container.nodeStart) continue;
    if (block.endOffset > container.nodeEnd) continue;

    const span = block.endOffset - block.startOffset;
    if (span <= 0) continue;

    const startsAtNodeBoundary = block.startOffset === container.nodeStart;

    if (!startsAtNodeBoundary && span > bestBodySpan) {
      bodyCount = block.executionCount;
      bestBodySpan = span;
    }

    if (block.executionCount > maxExecutionCount) {
      maxExecutionCount = block.executionCount;
    }
  }

  if (bodyCount !== undefined && bodyCount > 0) return bodyCount;
  return maxExecutionCount;
};

const absorbBasicBlocks = (
  fileAggregation: FileAggregation,
  program: Node,
  scriptBlocks: JscScriptBlocks,
  lineStartTable: number[]
): void => {
  const sourceLength = scriptBlocks.source.length;
  const containers = collectFunctionContainers(program, sourceLength);
  const blocksByContainer = new Map<JscFunctionContainer, JscBasicBlock[]>();

  for (const basicBlock of scriptBlocks.blocks) {
    const owner = findOwnerContainer(containers, basicBlock);
    const bucket = blocksByContainer.get(owner);

    if (bucket === undefined) blocksByContainer.set(owner, [basicBlock]);
    else bucket.push(basicBlock);
  }

  for (const container of containers) {
    const ownedBlocks = blocksByContainer.get(container) ?? [];
    if (!container.isModuleFunction && ownedBlocks.length === 0) continue;

    const functionKey = `${container.nodeStart}-${container.nodeEnd}`;
    let functionEntry = fileAggregation.functions.get(functionKey);

    if (functionEntry === undefined) {
      const location = offsets.toLocation(container.nodeStart, lineStartTable);
      const blocksForCount = container.isModuleFunction
        ? scriptBlocks.blocks
        : ownedBlocks;

      functionEntry = {
        line: location.line,
        column: location.column,
        name: container.name,
        startOffset: container.nodeStart,
        endOffset: container.nodeEnd,
        outerCount: resolveBodyCount(container, blocksForCount),
        isBlockCoverage: true,
        isModuleFunction: container.isModuleFunction,
        subRanges: new Map(),
        blocks: [],
      };

      fileAggregation.functions.set(functionKey, functionEntry);
    }

    const sortedBlocks = [...ownedBlocks].sort(
      (left, right) => left.startOffset - right.startOffset
    );

    for (const basicBlock of sortedBlocks) {
      const subRangeKey = `${basicBlock.startOffset}-${basicBlock.endOffset}`;
      if (functionEntry.subRanges.has(subRangeKey)) continue;

      const [subRangeLine] = offsets.rangeLines(
        basicBlock.startOffset,
        basicBlock.endOffset,
        lineStartTable
      );

      functionEntry.subRanges.set(subRangeKey, {
        line: subRangeLine,
        startOffset: basicBlock.startOffset,
        endOffset: basicBlock.endOffset,
        takenCount: basicBlock.executionCount,
        indexInFunction: functionEntry.subRanges.size,
      });
    }
  }
};

const findLineIndex = (
  lineStartTable: number[],
  byteOffset: number
): number => {
  let low = 0;
  let high = lineStartTable.length - 1;

  while (low < high) {
    const middle = (low + high + 1) >>> 1;

    if (lineStartTable[middle] <= byteOffset) low = middle;
    else high = middle - 1;
  }

  return low;
};

const computeLineHitsFromBlocks = (
  scriptBlocks: JscScriptBlocks,
  functionContainers: readonly JscFunctionContainer[],
  lineStartTable: number[],
  totalLines: number
): Map<number, number> => {
  const lineHits = new Map<number, number>();
  const functionContainerList = functionContainers.filter(
    (container) => !container.isModuleFunction
  );

  const isFunctionRangeBlock = (basicBlock: JscBasicBlock): boolean => {
    for (const container of functionContainerList) {
      if (basicBlock.startOffset !== container.nodeStart) continue;

      const endDelta = container.nodeEnd - basicBlock.endOffset;

      if (endDelta >= 0 && endDelta <= 1) return true;
    }

    return false;
  };

  for (const basicBlock of scriptBlocks.blocks) {
    if (basicBlock.endOffset <= basicBlock.startOffset) continue;
    if (isFunctionRangeBlock(basicBlock)) continue;

    const hasExecuted = basicBlock.hasExecuted || basicBlock.executionCount > 0;
    const min = Math.min(basicBlock.startOffset, basicBlock.endOffset);
    const max = Math.max(basicBlock.startOffset, basicBlock.endOffset);

    for (let byteOffset = min; byteOffset < max; byteOffset++) {
      const lineIndex = findLineIndex(lineStartTable, byteOffset);
      const lineStartByteOffset = lineStartTable[lineIndex];

      if (lineStartByteOffset >= byteOffset) continue;

      const lineNumber = lineIndex + 1;
      if (lineNumber < 1 || lineNumber > totalLines) continue;

      const existing = lineHits.get(lineNumber);

      if (existing === undefined) {
        lineHits.set(lineNumber, hasExecuted ? 1 : 0);
      } else if (hasExecuted) {
        lineHits.set(lineNumber, existing + 1);
      }
    }
  }

  return lineHits;
};

export const jscExtraction = {
  absorbBasicBlocks,
  computeLineHitsFromBlocks,
  collectFunctionContainers,
  resolveBodyCount,
} as const;
