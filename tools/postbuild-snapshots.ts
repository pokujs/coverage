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
import { platform } from 'node:process';
import { fileURLToPath } from 'node:url';

type DedupPlatform = 'darwin' | 'linux' | 'win32';

type DedupReport = {
  platform: DedupPlatform;
  groups: number;
  linksCreated: number;
  bytesSaved: number;
};

const platforms: readonly DedupPlatform[] = ['darwin', 'linux', 'win32'];

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

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

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

const dedupePlatform = (targetPlatform: DedupPlatform): DedupReport => {
  const files = collectPlatformFiles(targetPlatform);

  for (const filePath of files) materialize(filePath);

  const hashGroups = new Map<string, string[]>();

  for (const filePath of files) {
    const digest = hashFile(filePath);
    const existing = hashGroups.get(digest);

    if (existing) existing.push(filePath);
    else hashGroups.set(digest, [filePath]);
  }

  let groups = 0;
  let linksCreated = 0;
  let bytesSaved = 0;

  for (const group of hashGroups.values()) {
    if (group.length < 2) continue;

    group.sort((left, right) => left.localeCompare(right));

    const [targetPath, ...duplicates] = group;
    const targetSize = lstatSync(targetPath).size;

    groups += 1;

    for (const duplicatePath of duplicates) {
      rmSync(duplicatePath);
      symlinkSync(
        relative(dirname(duplicatePath), targetPath),
        duplicatePath
      );

      linksCreated += 1;
      bytesSaved += targetSize;
    }
  }

  return {
    platform: targetPlatform,
    groups,
    linksCreated,
    bytesSaved,
  };
};

if (platform === 'win32') {
  console.log('postbuild:snapshots skipped on win32');
} else {
  const reports = platforms.map(dedupePlatform);

  let totalGroups = 0;
  let totalLinks = 0;
  let totalBytes = 0;

  for (const report of reports) {
    console.log(
      `${report.platform}: groups=${report.groups}, links-created=${report.linksCreated}, bytes-saved=${formatBytes(report.bytesSaved)}`
    );

    totalGroups += report.groups;
    totalLinks += report.linksCreated;
    totalBytes += report.bytesSaved;
  }

  console.log(
    `total: groups=${totalGroups}, links-created=${totalLinks}, bytes-saved=${formatBytes(totalBytes)}`
  );
}
