/*
 * Adapted from monocart-coverage-reports (BSD/ISC).
 * Original: https://github.com/bcoe/v8-coverage
 *           https://github.com/demurgos/v8-coverage
 */

import type { V8Range } from '../../@types/v8.js';

export class RangeTree {
  start: number;
  end: number;
  delta: number;
  children: RangeTree[];

  constructor(
    start: number,
    end: number,
    delta: number,
    children: RangeTree[]
  ) {
    this.start = start;
    this.end = end;
    this.delta = delta;
    this.children = children;
  }

  normalize(): void {
    const normalizedChildren: RangeTree[] = [];
    const tail: RangeTree[] = [];
    let head: RangeTree | undefined;
    let headEnd = 0;

    const endChain = (): void => {
      if (!head) return;

      if (tail.length !== 0) {
        head.end = tail[tail.length - 1].end;

        for (const tailTree of tail)
          for (const tailChild of tailTree.children) {
            tailChild.delta += tailTree.delta - head.delta;
            head.children.push(tailChild);
          }

        tail.length = 0;
      }

      head.normalize();
      normalizedChildren.push(head);
    };

    for (const child of this.children) {
      if (!head) {
        head = child;
      } else if (child.delta === head.delta && child.start === headEnd) {
        tail.push(child);
      } else {
        endChain();

        head = child;
      }

      headEnd = child.end;
    }

    if (head) endChain();

    if (normalizedChildren.length === 1) {
      const onlyChild = normalizedChildren[0];

      if (onlyChild.start === this.start && onlyChild.end === this.end) {
        this.delta += onlyChild.delta;
        this.children = onlyChild.children;
        return;
      }
    }

    this.children = normalizedChildren;
  }

  split(value: number): RangeTree {
    let leftChildCount = this.children.length;
    let midNode: RangeTree | undefined;

    for (let childIndex = 0; childIndex < this.children.length; childIndex++) {
      const child = this.children[childIndex];

      if (child.start < value && value < child.end) {
        midNode = child.split(value);
        leftChildCount = childIndex + 1;
        break;
      } else if (child.start >= value) {
        leftChildCount = childIndex;
        break;
      }
    }

    const rightChildCount = this.children.length - leftChildCount;
    const rightChildren = this.children.splice(leftChildCount, rightChildCount);

    if (midNode) rightChildren.unshift(midNode);

    const rightTree = new RangeTree(value, this.end, this.delta, rightChildren);

    this.end = value;

    return rightTree;
  }

  toRanges(): V8Range[] {
    const ranges: V8Range[] = [];
    const stack: Array<[RangeTree, number]> = [[this, 0]];

    while (stack.length > 0) {
      const frame = stack.pop();
      if (!frame) break;

      const [currentTree, parentCount] = frame;
      const count = parentCount + currentTree.delta;

      ranges.push({
        startOffset: currentTree.start,
        endOffset: currentTree.end,
        count,
      });

      for (
        let childIndex = currentTree.children.length - 1;
        childIndex >= 0;
        childIndex--
      )
        stack.push([currentTree.children[childIndex], count]);
    }

    return ranges;
  }

  static fromSortedRanges(ranges: V8Range[]): RangeTree | undefined {
    let root: RangeTree | undefined;
    const stack: Array<[RangeTree, number]> = [];

    for (const range of ranges) {
      const node = new RangeTree(
        range.startOffset,
        range.endOffset,
        range.count,
        []
      );

      if (!root) {
        root = node;

        stack.push([node, range.count]);
        continue;
      }

      let parent: RangeTree = stack[stack.length - 1][0];
      let parentCount: number = stack[stack.length - 1][1];

      while (true) {
        parent = stack[stack.length - 1][0];
        parentCount = stack[stack.length - 1][1];

        if (range.startOffset < parent.end) break;

        stack.pop();

        if (stack.length === 0) break;
      }

      node.delta -= parentCount;
      parent.children.push(node);
      stack.push([node, range.count]);
    }

    return root;
  }
}
