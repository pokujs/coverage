import type { V8Range } from '../../@types/v8.js';

const isArmCovered = (
  armStart: number,
  armEnd: number,
  allScriptRanges: readonly V8Range[]
): boolean => {
  const armWidth = Math.max(armEnd - armStart, 0);

  for (const candidateRange of allScriptRanges) {
    if (candidateRange.count > 0) continue;
    if (candidateRange.startOffset > armStart) continue;
    if (candidateRange.endOffset < armEnd) continue;

    const candidateSpan = candidateRange.endOffset - candidateRange.startOffset;
    if (candidateSpan < armWidth) continue;

    return false;
  }

  return true;
};

export const armCoverage = { isArmCovered } as const;
