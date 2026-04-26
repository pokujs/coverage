import type { PackageGroup } from '../../@types/reporters.js';
import { paths } from '../../utils/paths.js';

const directoryOf = (relativePath: string): string => {
  const normalized = paths.toPosix(relativePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
};

/** Mirrors istanbul-lib-report's `pkg` summarizer (direct children only). */
export const groupByPackage = <Entry>(
  entries: readonly Entry[],
  getPath: (entry: Entry) => string,
  cwd: string
): PackageGroup<Entry>[] => {
  const groups = new Map<string, PackageGroup<Entry>>();

  for (const entry of entries) {
    const absolutePath = getPath(entry);
    const relativePath = paths.relativize(absolutePath, cwd);
    const relativeDir = directoryOf(relativePath);
    const packageName =
      relativeDir.length === 0 ? 'main' : relativeDir.replaceAll('/', '.');

    let group = groups.get(relativeDir);
    if (!group) {
      group = { relativeDir, packageName, files: [] };
      groups.set(relativeDir, group);
    }
    group.files.push(entry);
  }

  return Array.from(groups.values()).sort((left, right) =>
    left.relativeDir.localeCompare(right.relativeDir)
  );
};
