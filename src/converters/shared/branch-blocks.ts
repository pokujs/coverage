import type { Node } from 'acorn';
import type {
  BlockTemplate,
  BranchArmEntry,
  BranchBlockEntry,
  PendingBlock,
} from '../../@types/branch-blocks.js';
import type { AstArmRange } from '../../@types/branch-discovery.js';
import type { FileAggregation, SubRangeEntry } from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const getChild = (node: Node, property: string): Node | null => {
  const value: unknown = Reflect.get(node, property);

  if (value === null || value === undefined) return null;
  return astWalk.isNodeLike(value) ? value : null;
};

const getChildren = (node: Node, property: string): Node[] => {
  const value: unknown = Reflect.get(node, property);

  if (!Array.isArray(value)) return [];
  return value.filter(astWalk.isNodeLike);
};

const isOptionalChainMember = (node: Node): boolean =>
  node.type === 'MemberExpression' && astWalk.isOptionalChaining(node);

const isOptionalChainCall = (node: Node): boolean =>
  node.type === 'CallExpression' && astWalk.isOptionalChaining(node);

const describeBlock = (node: Node): BlockTemplate | null => {
  if (node.type === 'IfStatement') {
    const consequent = getChild(node, 'consequent');
    if (consequent === null) return null;

    const alternate = getChild(node, 'alternate');
    const arms: AstArmRange[] = [
      { armStart: consequent.start, armEnd: consequent.end },
    ];

    if (alternate !== null)
      arms.push({ armStart: alternate.start, armEnd: alternate.end });

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: arms,
      inferMissingAsComplement: true,
    };
  }

  if (node.type === 'ConditionalExpression') {
    const consequent = getChild(node, 'consequent');
    const alternate = getChild(node, 'alternate');

    if (consequent === null || alternate === null) return null;
    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [
        { armStart: consequent.start, armEnd: consequent.end },
        { armStart: alternate.start, armEnd: alternate.end },
      ],
      inferMissingAsComplement: false,
    };
  }

  if (node.type === 'LogicalExpression') {
    const right = getChild(node, 'right');
    if (right === null) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: right.start, armEnd: right.end }],
      inferMissingAsComplement: true,
    };
  }

  if (node.type === 'AssignmentPattern') {
    const right = getChild(node, 'right');
    if (right === null) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: right.start, armEnd: right.end }],
      inferMissingAsComplement: true,
    };
  }

  if (node.type === 'SwitchStatement') {
    const cases = getChildren(node, 'cases');
    if (cases.length === 0) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: cases.map((caseNode) => ({
        armStart: caseNode.start,
        armEnd: caseNode.end,
      })),
      inferMissingAsComplement: false,
    };
  }

  if (
    node.type === 'ForStatement' ||
    node.type === 'ForInStatement' ||
    node.type === 'ForOfStatement' ||
    node.type === 'WhileStatement' ||
    node.type === 'DoWhileStatement'
  ) {
    const body = getChild(node, 'body');
    if (body === null) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: body.start, armEnd: body.end }],
      inferMissingAsComplement: false,
    };
  }

  if (node.type === 'TryStatement') {
    const handler = getChild(node, 'handler');
    if (handler === null) return null;

    const handlerBody = getChild(handler, 'body');
    if (handlerBody === null) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: handlerBody.start, armEnd: handlerBody.end }],
      inferMissingAsComplement: false,
    };
  }

  if (isOptionalChainMember(node)) {
    const object = getChild(node, 'object');
    const property = getChild(node, 'property');

    if (object === null || property === null) return null;
    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: property.start, armEnd: property.end }],
      inferMissingAsComplement: true,
    };
  }

  if (isOptionalChainCall(node)) {
    const callee = getChild(node, 'callee');
    if (callee === null) return null;

    return {
      nodeStart: node.start,
      nodeEnd: node.end,
      expectedArms: [{ armStart: callee.end, armEnd: node.end }],
      inferMissingAsComplement: true,
    };
  }

  return null;
};

const collectTemplates = (program: Node): BlockTemplate[] => {
  const templates: BlockTemplate[] = [];

  astWalk.forEachNode(program, (node) => {
    const template = describeBlock(node);
    if (template !== null) templates.push(template);
  });

  templates.sort((left, right) => {
    if (left.nodeStart !== right.nodeStart)
      return left.nodeStart - right.nodeStart;
    return right.nodeEnd - left.nodeEnd;
  });

  return templates;
};

const startsInside = (
  template: BlockTemplate,
  subRangeStart: number
): boolean =>
  subRangeStart >= template.nodeStart && subRangeStart <= template.nodeEnd;

const MAX_PREFIX_GAP = 4;
const MAX_SUFFIX_GAP = 8;

const findArmIndex = (
  template: BlockTemplate,
  subRangeStart: number,
  subRangeEnd: number
): number => {
  for (let armIndex = 0; armIndex < template.expectedArms.length; armIndex++) {
    const arm = template.expectedArms[armIndex];
    const startGap = arm.armStart - subRangeStart;

    if (startGap < 0 || startGap > MAX_PREFIX_GAP) continue;
    if (subRangeEnd >= arm.armEnd) return armIndex;

    const endGap = arm.armEnd - subRangeEnd;
    if (endGap >= 0 && endGap <= MAX_SUFFIX_GAP) return armIndex;
  }

  return -1;
};

const armLine = (
  template: BlockTemplate,
  armIndex: number,
  lineStartTable: number[]
): number => {
  const arm = template.expectedArms[armIndex];
  const [line] = offsets.rangeLines(arm.armStart, arm.armEnd, lineStartTable);

  return line;
};

const blockLine = (
  template: BlockTemplate,
  lineStartTable: number[]
): number => {
  const [line] = offsets.rangeLines(
    template.nodeStart,
    template.nodeEnd,
    lineStartTable
  );

  return line;
};

const buildBlocksForFunction = (
  functionTemplates: readonly BlockTemplate[],
  functionSubRanges: readonly SubRangeEntry[],
  outerCount: number,
  lineStartTable: number[]
): BranchBlockEntry[] => {
  const pendings: PendingBlock[] = functionTemplates.map((template) => ({
    template,
    claimed: template.expectedArms.map(() => null),
    firstClaimedOrder: Number.POSITIVE_INFINITY,
  }));

  for (const subRange of functionSubRanges) {
    let matchedPending: PendingBlock | null = null;
    let matchedArmIndex = -1;
    let matchedSpan = Number.POSITIVE_INFINITY;

    for (const pending of pendings) {
      if (!startsInside(pending.template, subRange.startOffset)) continue;

      const armIndex = findArmIndex(
        pending.template,
        subRange.startOffset,
        subRange.endOffset
      );

      if (armIndex === -1) continue;

      const span = pending.template.nodeEnd - pending.template.nodeStart;
      if (span < matchedSpan) {
        matchedPending = pending;
        matchedArmIndex = armIndex;
        matchedSpan = span;
      }
    }

    if (matchedPending === null) continue;

    matchedPending.claimed[matchedArmIndex] = subRange;
    if (subRange.indexInFunction < matchedPending.firstClaimedOrder)
      matchedPending.firstClaimedOrder = subRange.indexInFunction;
  }

  const blocks: BranchBlockEntry[] = [];

  for (const pending of pendings) {
    const claimedSome = pending.claimed.some(
      (claimedEntry) => claimedEntry !== null
    );
    if (!claimedSome) continue;

    const arms: BranchArmEntry[] = [];

    for (
      let armIndex = 0;
      armIndex < pending.template.expectedArms.length;
      armIndex++
    ) {
      const claimed = pending.claimed[armIndex];
      const line =
        claimed !== null
          ? claimed.line
          : armLine(pending.template, armIndex, lineStartTable);
      const taken = claimed !== null ? claimed.takenCount : 0;

      arms.push({ line, takenCount: taken });
    }

    if (pending.template.inferMissingAsComplement) {
      const claimedSum = pending.claimed.reduce(
        (accumulator, claimedEntry) =>
          accumulator + (claimedEntry !== null ? claimedEntry.takenCount : 0),
        0
      );

      const complementTaken = Math.max(0, outerCount - claimedSum);
      const complementLine = blockLine(pending.template, lineStartTable);

      arms.push({ line: complementLine, takenCount: complementTaken });
    }

    blocks.push({
      line: blockLine(pending.template, lineStartTable),
      startOffset: pending.template.nodeStart,
      endOffset: pending.template.nodeEnd,
      order: pending.firstClaimedOrder,
      arms,
    });
  }

  return blocks;
};

const build = (
  fileAggregation: FileAggregation,
  source: string,
  lineStartTable: number[]
): void => {
  const program = astCache.parse(source);
  if (program === null) return;

  const templates = collectTemplates(program);

  for (const functionEntry of fileAggregation.functions.values()) {
    if (!functionEntry.isBlockCoverage) continue;
    if (functionEntry.subRanges.size === 0) {
      functionEntry.blocks = [];
      continue;
    }

    const functionTemplates = templates.filter(
      (template) =>
        template.nodeStart >= functionEntry.startOffset &&
        template.nodeEnd <= functionEntry.endOffset
    );

    const sortedSubRanges = Array.from(functionEntry.subRanges.values()).sort(
      (left, right) => left.indexInFunction - right.indexInFunction
    );

    functionEntry.blocks = buildBlocksForFunction(
      functionTemplates,
      sortedSubRanges,
      functionEntry.outerCount,
      lineStartTable
    );
  }
};

export const branchBlocks = {
  build,
} as const;
