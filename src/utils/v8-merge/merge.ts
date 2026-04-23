/*
 * Adapted from monocart-coverage-reports (BSD/ISC).
 * Original: https://github.com/bcoe/v8-coverage
 *           https://github.com/demurgos/v8-coverage
 */

import type {
  OpenRange,
  ParentChildRef,
  StartEvent,
  V8Function,
  V8Range,
} from '../../@types/v8.js';
import { RangeTree } from './range-tree.js';

class StartEventQueue {
  private readonly queue: StartEvent[];
  private nextIndex: number;
  private pendingOffset: number;
  private pendingTrees: ParentChildRef[] | null;

  constructor(queue: StartEvent[]) {
    this.queue = queue;
    this.nextIndex = 0;
    this.pendingOffset = 0;
    this.pendingTrees = null;
  }

  setPendingOffset(offset: number): void {
    this.pendingOffset = offset;
  }

  pushPendingTree(tree: ParentChildRef): void {
    if (this.pendingTrees === null) this.pendingTrees = [];

    this.pendingTrees.push(tree);
  }

  next(): StartEvent | undefined {
    const pendingTrees = this.pendingTrees;
    const nextEvent = this.queue[this.nextIndex];

    if (pendingTrees === null) {
      this.nextIndex++;

      return nextEvent;
    }

    if (!nextEvent) {
      this.pendingTrees = null;

      return {
        offset: this.pendingOffset,
        trees: pendingTrees,
      };
    }

    if (this.pendingOffset < nextEvent.offset) {
      this.pendingTrees = null;

      return {
        offset: this.pendingOffset,
        trees: pendingTrees,
      };
    }

    if (this.pendingOffset === nextEvent.offset) {
      this.pendingTrees = null;

      for (const tree of pendingTrees) nextEvent.trees.push(tree);
    }

    this.nextIndex++;

    return nextEvent;
  }
}

const compareRangeCovs = (left: V8Range, right: V8Range): number => {
  if (left.startOffset !== right.startOffset)
    return left.startOffset - right.startOffset;

  return right.endOffset - left.endOffset;
};

const compareFunctionCovs = (left: V8Function, right: V8Function): number =>
  compareRangeCovs(left.ranges[0], right.ranges[0]);

const normalizeFunctionCov = (functionCoverage: V8Function): void => {
  functionCoverage.ranges.sort(compareRangeCovs);

  const tree = RangeTree.fromSortedRanges(functionCoverage.ranges);
  if (!tree) return;

  tree.normalize();

  functionCoverage.ranges = tree.toRanges();
};

const normalizeScriptFunctions = (functions: V8Function[]): void => {
  functions.sort(compareFunctionCovs);
};

const stringifyFunctionRootRange = (functionCoverage: V8Function): string => {
  const rootRange = functionCoverage.ranges[0];

  return `${rootRange.startOffset.toString(10)};${rootRange.endOffset.toString(10)}`;
};

const insertChild = (
  parentToNested: Map<number, RangeTree[]>,
  parentIndex: number,
  tree: RangeTree
): void => {
  let nested = parentToNested.get(parentIndex);

  if (!nested) {
    nested = [];

    parentToNested.set(parentIndex, nested);
  }

  nested.push(tree);
};

const nextChild = (
  openRange: OpenRange,
  parentToNested: Map<number, RangeTree[]>
): RangeTree => {
  const matchingTrees: RangeTree[] = [];

  for (const nested of parentToNested.values()) {
    if (
      nested.length === 1 &&
      nested[0].start === openRange.start &&
      nested[0].end === openRange.end
    ) {
      matchingTrees.push(nested[0]);
    } else {
      matchingTrees.push(
        new RangeTree(openRange.start, openRange.end, 0, nested)
      );
    }
  }

  parentToNested.clear();
  const merged = mergeRangeTrees(matchingTrees);

  if (!merged) return new RangeTree(openRange.start, openRange.end, 0, []);
  return merged;
};

const fromParentTrees = (parentTrees: RangeTree[]): StartEventQueue => {
  const startToTrees = new Map<number, ParentChildRef[]>();
  const queue: StartEvent[] = [];

  for (let parentIndex = 0; parentIndex < parentTrees.length; parentIndex++) {
    const parentTree = parentTrees[parentIndex];

    for (const child of parentTree.children) {
      let trees = startToTrees.get(child.start);

      if (!trees) {
        trees = [];

        startToTrees.set(child.start, trees);
      }

      trees.push({ parentIndex, tree: child });
    }
  }

  for (const [startOffset, trees] of startToTrees)
    queue.push({ offset: startOffset, trees });

  queue.sort((left, right) => left.offset - right.offset);

  return new StartEventQueue(queue);
};

const mergeRangeTreeChildren = (parentTrees: RangeTree[]): RangeTree[] => {
  const result: RangeTree[] = [];
  const startEventQueue = fromParentTrees(parentTrees);
  const parentToNested = new Map<number, RangeTree[]>();
  let openRange: OpenRange | null = null;

  while (true) {
    const event = startEventQueue.next();
    if (!event) break;

    if (openRange !== null && openRange.end <= event.offset) {
      result.push(nextChild(openRange, parentToNested));

      openRange = null;
    }

    if (openRange === null) {
      let openRangeEnd = event.offset + 1;

      for (const { parentIndex, tree } of event.trees) {
        openRangeEnd = Math.max(openRangeEnd, tree.end);

        insertChild(parentToNested, parentIndex, tree);
      }

      startEventQueue.setPendingOffset(openRangeEnd);

      openRange = { start: event.offset, end: openRangeEnd };
    } else {
      for (const { parentIndex, tree } of event.trees) {
        if (tree.end > openRange.end) {
          const right = tree.split(openRange.end);

          startEventQueue.pushPendingTree({ parentIndex, tree: right });
        }

        insertChild(parentToNested, parentIndex, tree);
      }
    }
  }

  if (openRange !== null) result.push(nextChild(openRange, parentToNested));

  return result;
};

const mergeRangeTrees = (trees: RangeTree[]): RangeTree | undefined => {
  if (trees.length === 0) return undefined;
  if (trees.length === 1) return trees[0];

  const first = trees[0];
  let delta = 0;

  for (const tree of trees) delta += tree.delta;

  const children = mergeRangeTreeChildren(trees);

  return new RangeTree(first.start, first.end, delta, children);
};

const mergeFunctionCovs = (
  functionCoverages: V8Function[]
): V8Function | undefined => {
  if (functionCoverages.length === 0) return undefined;

  if (functionCoverages.length === 1) {
    const onlyCoverage = functionCoverages[0];

    normalizeFunctionCov(onlyCoverage);

    return onlyCoverage;
  }

  const first = functionCoverages[0];
  const functionName = first.functionName;
  const startOffset = first.ranges[0].startOffset;
  const endOffset = first.ranges[0].endOffset;
  const trees: RangeTree[] = [];
  let count = 0;

  for (const coverage of functionCoverages) {
    count += coverage.ranges[0].count;

    if (coverage.isBlockCoverage) {
      const tree = RangeTree.fromSortedRanges(coverage.ranges);

      if (tree) trees.push(tree);
    }
  }

  let isBlockCoverage: boolean;
  let ranges: V8Range[];

  if (trees.length > 0) {
    const mergedTree = mergeRangeTrees(trees);

    isBlockCoverage = true;

    if (mergedTree) {
      mergedTree.normalize();

      ranges = mergedTree.toRanges();
    } else {
      ranges = [{ startOffset, endOffset, count }];
    }
  } else {
    isBlockCoverage = false;
    ranges = [{ startOffset, endOffset, count }];
  }

  return {
    functionName,
    ranges,
    isBlockCoverage,
  };
};

const mergeFunctions = (
  functionsFromAllJsons: V8Function[][]
): V8Function[] => {
  if (functionsFromAllJsons.length === 0) return [];

  const allFunctions: V8Function[] = [];

  for (const functions of functionsFromAllJsons)
    for (const functionCoverage of functions) {
      if (functionCoverage.ranges.length === 0) continue;

      allFunctions.push(functionCoverage);
    }

  if (allFunctions.length === 0) return [];

  const rangeToFunctions = new Map<string, V8Function[]>();

  for (const functionCoverage of allFunctions) {
    const rootRange = stringifyFunctionRootRange(functionCoverage);
    let group = rangeToFunctions.get(rootRange);

    if (!group) {
      group = [];

      rangeToFunctions.set(rootRange, group);
    }

    group.push(functionCoverage);
  }

  const mergedFunctions: V8Function[] = [];

  for (const group of rangeToFunctions.values()) {
    const merged = mergeFunctionCovs(group);

    if (merged) mergedFunctions.push(merged);
  }

  normalizeScriptFunctions(mergedFunctions);

  return mergedFunctions;
};

export const v8Merge = {
  mergeFunctions,
} as const;
