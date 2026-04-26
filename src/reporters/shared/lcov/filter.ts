import type { ResolvedFileFilter } from '../../../@types/file-filter.js';
import { isAbsolute, resolve } from 'node:path';
import { fileFilter } from '../../../file-filter.js';
import { paths } from '../../../utils/paths.js';

export const filter = (
  lcov: string,
  testFiles: ReadonlySet<string>,
  cwd: string,
  resolvedFilter: ResolvedFileFilter
): string => {
  if (lcov.length === 0) return lcov;

  const records = lcov.split(/end_of_record\r?\n?/);
  const kept: string[] = [];

  for (const record of records) {
    if (record.length === 0) continue;

    const sourceMatch = record.match(/(?:^|\n)SF:([^\r\n]+)/);

    if (sourceMatch) {
      const sourcePath = sourceMatch[1].trim();
      const absoluteSourcePath = isAbsolute(sourcePath)
        ? sourcePath
        : resolve(cwd, sourcePath);

      if (paths.isBanned(absoluteSourcePath)) continue;
      if (testFiles.has(absoluteSourcePath)) continue;
      if (!fileFilter.matches(resolvedFilter, absoluteSourcePath, cwd))
        continue;
    }

    kept.push(`${record}end_of_record\n`);
  }

  return kept.join('');
};
