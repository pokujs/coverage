import type { Metric } from '../../@types/text.js';
import type { CoverageModel, FileCoverage } from '../../@types/tree.js';
import { isAbsolute, resolve } from 'node:path';

const emptyMetric = (): Metric => ({ total: null, hit: null });

export const parse = (content: string, cwd: string): CoverageModel => {
  const filesByPath = new Map<string, FileCoverage>();
  let current: FileCoverage | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();

    if (line.startsWith('SF:')) {
      const rawSourcePath = line.slice(3);
      const path = isAbsolute(rawSourcePath)
        ? rawSourcePath
        : resolve(cwd, rawSourcePath);

      let file = filesByPath.get(path);
      if (!file) {
        file = {
          file: path,
          lineHits: new Map(),
          functions: emptyMetric(),
          branches: emptyMetric(),
          uncoveredBranchPositions: [],
          uncoveredFunctionPositions: [],
        };

        filesByPath.set(path, file);
      }
      current = file;
      continue;
    }

    if (!current) continue;

    if (line.startsWith('DA:')) {
      const [lineNumberStr, hitsStr] = line.slice(3).split(',');
      const lineNumber = Number(lineNumberStr);
      const hits = Number(hitsStr);

      if (Number.isFinite(lineNumber) && Number.isFinite(hits))
        current.lineHits.set(
          lineNumber,
          (current.lineHits.get(lineNumber) ?? 0) + hits
        );
    } else if (line.startsWith('FNF:')) {
      const value = Number(line.slice(4));
      if (Number.isFinite(value))
        current.functions.total = Math.max(current.functions.total ?? 0, value);
    } else if (line.startsWith('FNH:')) {
      const value = Number(line.slice(4));
      if (Number.isFinite(value))
        current.functions.hit = Math.max(current.functions.hit ?? 0, value);
    } else if (line.startsWith('BRF:')) {
      const value = Number(line.slice(4));
      if (Number.isFinite(value))
        current.branches.total = Math.max(current.branches.total ?? 0, value);
    } else if (line.startsWith('BRH:')) {
      const value = Number(line.slice(4));
      if (Number.isFinite(value))
        current.branches.hit = Math.max(current.branches.hit ?? 0, value);
    } else if (line === 'end_of_record') {
      current = null;
    }
  }

  return Array.from(filesByPath.values());
};
