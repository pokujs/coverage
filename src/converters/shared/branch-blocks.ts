import type { Node } from 'acorn';
import type { TypedNode } from '../../@types/acorn-nodes.js';
import type {
  BlockTemplate,
  BranchArmEntry,
  BranchBlockEntry,
  PendingBlock,
} from '../../@types/branch-blocks.js';
import type { AstArmRange } from '../../@types/branch-discovery.js';
import type {
  FileAggregation,
  FunctionEntry,
  SubRangeEntry,
} from '../../@types/v8.js';
import { offsets } from '../../utils/offsets.js';
import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const describeBlock = (node: Node): BlockTemplate | null => {
  const typed = node as TypedNode;

  if (typed.type === 'IfStatement') {
    const arms: AstArmRange[] = [
      { armStart: typed.consequent.start, armEnd: typed.consequent.end },
    ];

    if (typed.alternate !== null)
      arms.push({
        armStart: typed.alternate.start,
        armEnd: typed.alternate.end,
      });

    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: arms,
      inferMissingAsComplement: true,
    };
  }

  if (typed.type === 'ConditionalExpression') {
    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: [
        { armStart: typed.consequent.start, armEnd: typed.consequent.end },
        { armStart: typed.alternate.start, armEnd: typed.alternate.end },
      ],
      inferMissingAsComplement: false,
    };
  }

  if (typed.type === 'LogicalExpression') {
    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: [{ armStart: typed.right.start, armEnd: typed.right.end }],
      inferMissingAsComplement: true,
    };
  }

  if (typed.type === 'AssignmentPattern') {
    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: [{ armStart: typed.right.start, armEnd: typed.right.end }],
      inferMissingAsComplement: true,
    };
  }

  if (typed.type === 'SwitchStatement') {
    if (typed.cases.length === 0) return null;

    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: typed.cases.map((caseNode) => ({
        armStart: caseNode.start,
        armEnd: caseNode.end,
      })),
      inferMissingAsComplement: false,
    };
  }

  if (
    typed.type === 'ForStatement' ||
    typed.type === 'ForInStatement' ||
    typed.type === 'ForOfStatement' ||
    typed.type === 'WhileStatement' ||
    typed.type === 'DoWhileStatement'
  ) {
    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: [{ armStart: typed.body.start, armEnd: typed.body.end }],
      inferMissingAsComplement: false,
    };
  }

  if (typed.type === 'TryStatement') {
    if (typed.handler === null) return null;

    return {
      nodeStart: typed.start,
      nodeEnd: typed.end,
      expectedArms: [
        {
          armStart: typed.handler.body.start,
          armEnd: typed.handler.body.end,
        },
      ],
      inferMissingAsComplement: false,
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

const evaluationCountFor = (
  template: BlockTemplate,
  functionSubRanges: readonly SubRangeEntry[],
  outerCount: number
): number => {
  let innermostSpan = Number.POSITIVE_INFINITY;
  let innermostCount: number | null = null;

  for (const subRange of functionSubRanges) {
    if (subRange.startOffset > template.nodeStart) continue;
    if (subRange.endOffset < template.nodeEnd) continue;
    if (subRange.takenCount === 0) continue;

    const span = subRange.endOffset - subRange.startOffset;
    if (span < innermostSpan) {
      innermostSpan = span;
      innermostCount = subRange.takenCount;
    }
  }

  return innermostCount ?? outerCount;
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

    const claimedCount = pending.claimed.reduce(
      (accumulator, claimedEntry) =>
        accumulator + (claimedEntry !== null ? 1 : 0),
      0
    );
    const claimedTakenSum = pending.claimed.reduce(
      (accumulator, claimedEntry) =>
        accumulator + (claimedEntry !== null ? claimedEntry.takenCount : 0),
      0
    );
    const evaluationCount = evaluationCountFor(
      pending.template,
      functionSubRanges,
      outerCount
    );
    const armCount = pending.template.expectedArms.length;
    const inferPartnerComplement = armCount === 2 && claimedCount === 1;
    const inferBothZeroComplement =
      armCount === 2 &&
      claimedCount === 2 &&
      claimedTakenSum === 0 &&
      evaluationCount > 0;

    const bothZeroFirstArmShare = Math.ceil(evaluationCount / 2);
    const bothZeroSecondArmShare = evaluationCount - bothZeroFirstArmShare;

    const arms: BranchArmEntry[] = [];

    for (
      let armIndex = 0;
      armIndex < pending.template.expectedArms.length;
      armIndex++
    ) {
      const claimed = pending.claimed[armIndex];
      const expectedArm = pending.template.expectedArms[armIndex];

      if (claimed !== null) {
        const armReportedLine = armLine(
          pending.template,
          armIndex,
          lineStartTable
        );

        if (inferBothZeroComplement) {
          const share =
            armIndex === 0 ? bothZeroFirstArmShare : bothZeroSecondArmShare;
          arms.push({
            line: armReportedLine,
            startOffset: expectedArm.armStart,
            endOffset: expectedArm.armEnd,
            takenCount: share,
          });
          continue;
        }
        arms.push({
          line: armReportedLine,
          startOffset: expectedArm.armStart,
          endOffset: expectedArm.armEnd,
          takenCount: claimed.takenCount,
        });
        continue;
      }

      const fallbackLine = armLine(pending.template, armIndex, lineStartTable);

      if (inferPartnerComplement) {
        const partner = pending.claimed.find(
          (claimedEntry) => claimedEntry !== null
        );
        const partnerTaken = partner !== null ? partner!.takenCount : 0;
        const complementTaken = Math.max(0, evaluationCount - partnerTaken);
        arms.push({
          line: fallbackLine,
          startOffset: expectedArm.armStart,
          endOffset: expectedArm.armEnd,
          takenCount: complementTaken,
        });
        continue;
      }

      arms.push({
        line: fallbackLine,
        startOffset: expectedArm.armStart,
        endOffset: expectedArm.armEnd,
        takenCount: 0,
      });
    }

    if (pending.template.inferMissingAsComplement) {
      const claimedSum = pending.claimed.reduce(
        (accumulator, claimedEntry) =>
          accumulator + (claimedEntry !== null ? claimedEntry.takenCount : 0),
        0
      );

      const complementTaken = Math.max(0, evaluationCount - claimedSum);
      const complementLine = blockLine(pending.template, lineStartTable);

      arms.push({
        line: complementLine,
        startOffset: pending.template.nodeStart,
        endOffset: pending.template.nodeEnd,
        takenCount: complementTaken,
      });
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

const findEnclosingFunction = (
  functionEntries: readonly FunctionEntry[],
  template: BlockTemplate
): FunctionEntry | null => {
  let matched: FunctionEntry | null = null;
  let matchedSpan = Number.POSITIVE_INFINITY;

  for (const candidate of functionEntries) {
    if (!candidate.isBlockCoverage) continue;
    if (candidate.startOffset > template.nodeStart) continue;
    if (candidate.endOffset < template.nodeEnd) continue;

    const span = candidate.endOffset - candidate.startOffset;
    if (span < matchedSpan) {
      matched = candidate;
      matchedSpan = span;
    }
  }

  return matched;
};

const build = (
  fileAggregation: FileAggregation,
  source: string,
  lineStartTable: number[]
): void => {
  const program = astCache.parse(source);
  if (program === null) {
    fileAggregation.blocks = [];
    return;
  }

  const templates = collectTemplates(program);
  if (templates.length === 0) {
    fileAggregation.blocks = [];
    return;
  }

  const functionEntries = Array.from(fileAggregation.functions.values());

  const allSubRanges: SubRangeEntry[] = [];
  const seenSubRangeKeys = new Set<string>();

  for (const functionEntry of functionEntries) {
    if (!functionEntry.isBlockCoverage) continue;

    for (const subRange of functionEntry.subRanges.values()) {
      const key = `${subRange.startOffset}-${subRange.endOffset}`;
      if (seenSubRangeKeys.has(key)) continue;
      seenSubRangeKeys.add(key);
      allSubRanges.push(subRange);
    }
  }

  allSubRanges.sort((left, right) => left.startOffset - right.startOffset);

  const templatesByEnclosing = new Map<number, BlockTemplate[]>();
  const enclosingByKey = new Map<number, FunctionEntry>();

  for (
    let templateIndex = 0;
    templateIndex < templates.length;
    templateIndex++
  ) {
    const template = templates[templateIndex];
    const enclosingFunction = findEnclosingFunction(functionEntries, template);
    if (enclosingFunction === null) continue;

    let bucket = templatesByEnclosing.get(enclosingFunction.startOffset);
    if (!bucket) {
      bucket = [];
      templatesByEnclosing.set(enclosingFunction.startOffset, bucket);
      enclosingByKey.set(enclosingFunction.startOffset, enclosingFunction);
    }
    bucket.push(template);
  }

  const blocks: BranchBlockEntry[] = [];

  for (const [enclosingKey, enclosingTemplates] of templatesByEnclosing) {
    const enclosingFunction = enclosingByKey.get(enclosingKey);
    if (!enclosingFunction) continue;

    const producedBlocks = buildBlocksForFunction(
      enclosingTemplates,
      allSubRanges,
      enclosingFunction.outerCount,
      lineStartTable
    );

    for (const block of producedBlocks) blocks.push(block);
  }

  blocks.sort((left, right) => {
    if (left.line !== right.line) return left.line - right.line;
    return left.startOffset - right.startOffset;
  });

  fileAggregation.blocks = blocks;
};

export const branchBlocks = {
  build,
} as const;
