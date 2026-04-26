import type { Node } from 'acorn';
import type { TypedNode } from '../../@types/acorn-nodes.js';
import type { BoundaryLine } from '../../@types/branch-blocks.js';
import type { FileAggregation, V8Range } from '../../@types/v8.js';
import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const endLine = (node: Node): number | null => node.loc?.end.line ?? null;

const startLine = (node: Node): number | null => node.loc?.start.line ?? null;

const sameLine = (left: Node, right: Node): boolean => {
  const leftEnd = endLine(left);
  const rightStart = startLine(right);

  if (leftEnd === null || rightStart === null) return false;
  return leftEnd === rightStart;
};

const collectBoundaries = (program: Node): BoundaryLine[] => {
  const boundaries: BoundaryLine[] = [];

  astWalk.forEachNode(program, (current) => {
    const typed = current as TypedNode;

    if (typed.type === 'TryStatement') {
      if (typed.handler !== null && sameLine(typed.block, typed.handler)) {
        const line = startLine(typed.handler);

        if (line !== null) {
          boundaries.push({
            line,
            startOffset: typed.handler.start,
            endOffset: typed.handler.end,
          });
        }
      }

      if (typed.finalizer !== null) {
        const previous = typed.handler ?? typed.block;

        if (sameLine(previous, typed.finalizer)) {
          const line = startLine(typed.finalizer);

          if (line !== null) {
            boundaries.push({
              line,
              startOffset: typed.finalizer.start,
              endOffset: typed.finalizer.end,
            });
          }
        }
      }

      return;
    }

    if (typed.type === 'IfStatement' && typed.alternate !== null) {
      if (sameLine(typed.consequent, typed.alternate)) {
        const line = startLine(typed.alternate);

        if (line !== null) {
          boundaries.push({
            line,
            startOffset: typed.alternate.start,
            endOffset: typed.alternate.end,
          });
        }
      }

      return;
    }

    if (typed.type === 'DoWhileStatement' && typed.test !== undefined) {
      if (sameLine(typed.body, typed.test)) {
        const line = startLine(typed.test);

        if (line !== null) {
          boundaries.push({
            line,
            startOffset: typed.test.start,
            endOffset: typed.test.end,
          });
        }
      }
    }
  });

  return boundaries;
};

const findEnvelopingPositiveCount = (
  ranges: readonly V8Range[],
  boundary: BoundaryLine
): number | null => {
  let bestCount: number | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;

  for (const range of ranges) {
    if (range.startOffset > boundary.startOffset) continue;
    if (range.endOffset < boundary.endOffset) continue;
    if (
      range.startOffset === boundary.startOffset &&
      range.endOffset === boundary.endOffset
    )
      continue;
    if (range.count <= 0) continue;

    const span = range.endOffset - range.startOffset;

    if (span < bestSpan) {
      bestSpan = span;
      bestCount = range.count;
    }
  }

  return bestCount;
};

const fix = (fileAggregation: FileAggregation, source: string): void => {
  const program = astCache.parse(source);
  if (program === null) return;

  const boundaries = collectBoundaries(program);
  if (boundaries.length === 0) return;

  const allRanges: V8Range[] = [];

  for (const functionEntry of fileAggregation.functions.values()) {
    allRanges.push({
      startOffset: functionEntry.startOffset,
      endOffset: functionEntry.endOffset,
      count: functionEntry.outerCount,
    });

    for (const subRange of functionEntry.subRanges.values()) {
      allRanges.push({
        startOffset: subRange.startOffset,
        endOffset: subRange.endOffset,
        count: subRange.takenCount,
      });
    }
  }

  for (const boundary of boundaries) {
    const existing = fileAggregation.lineHits.get(boundary.line);
    if (existing === undefined || existing > 0) continue;

    const envelopingCount = findEnvelopingPositiveCount(allRanges, boundary);
    if (envelopingCount === null) continue;

    fileAggregation.lineHits.set(boundary.line, envelopingCount);
  }
};

export const boundaryLines = {
  fix,
} as const;
