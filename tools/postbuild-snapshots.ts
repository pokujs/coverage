import { createHash } from 'node:crypto';
import {
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

type DedupPlatform = 'darwin' | 'linux' | 'win32';

const platforms: readonly DedupPlatform[] = ['darwin', 'linux', 'win32'];

let totalLinks = 0;

const snapshotsRoot = fileURLToPath(
  new URL('../test/__snapshots__/e2e/', import.meta.url)
);

const collectFiles = (directory: string, accumulator: string[]): void => {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      collectFiles(absolutePath, accumulator);
      continue;
    }

    accumulator.push(absolutePath);
  }
};

const materialize = (filePath: string): void => {
  if (!lstatSync(filePath).isSymbolicLink()) return;

  const resolved = readFileSync(filePath);

  rmSync(filePath);
  writeFileSync(filePath, resolved);
};

const hashFile = (filePath: string): string =>
  createHash('sha256').update(readFileSync(filePath)).digest('hex');

const collectPlatformFiles = (targetPlatform: DedupPlatform): string[] => {
  const files: string[] = [];
  const reporters = readdirSync(snapshotsRoot, { withFileTypes: true });

  for (const reporter of reporters) {
    if (!reporter.isDirectory()) continue;

    const reporterRoot = `${snapshotsRoot}${reporter.name}`;
    const runtimes = readdirSync(reporterRoot, { withFileTypes: true });

    for (const runtime of runtimes) {
      if (!runtime.isDirectory()) continue;

      const platformRoot = `${reporterRoot}/${runtime.name}/${targetPlatform}`;

      try {
        collectFiles(platformRoot, files);
      } catch {
        continue;
      }
    }
  }

  return files;
};

const dedupePlatform = (targetPlatform: DedupPlatform): number => {
  const files = collectPlatformFiles(targetPlatform);
  const hashGroups = new Map<string, string[]>();
  let linksCreated = 0;

  for (const filePath of files) materialize(filePath);

  for (const filePath of files) {
    const digest = hashFile(filePath);
    const existing = hashGroups.get(digest);

    if (existing) existing.push(filePath);
    else hashGroups.set(digest, [filePath]);
  }

  for (const group of hashGroups.values()) {
    if (group.length < 2) continue;

    group.sort((left, right) => left.localeCompare(right));

    const [targetPath, ...duplicates] = group;

    for (const duplicatePath of duplicates) {
      rmSync(duplicatePath);
      symlinkSync(relative(dirname(duplicatePath), targetPath), duplicatePath);

      linksCreated += 1;
    }
  }

  return linksCreated;
};

console.log('› Mirroring identical snapshots');

for (const targetPlatform of platforms) {
  totalLinks += dedupePlatform(targetPlatform);
}

console.log(`  ${totalLinks} links created`);
