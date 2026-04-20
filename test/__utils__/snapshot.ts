import type { CoverageSnapshot, TestCase } from '../../src/@types/tests.ts';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, posix, relative, sep } from 'node:path';
import { platform as currentPlatform, env } from 'node:process';
import { fileURLToPath } from 'node:url';
import { strict } from 'poku';

const snapshotsRoot = fileURLToPath(
  new URL('../__snapshots__/e2e/', import.meta.url)
);

const runtimePlatform = currentPlatform;

const resolveSnapshotPath = (target: TestCase): string =>
  `${snapshotsRoot}${target.reporter}/${target.runtime}/${runtimePlatform}/${target.name}.${target.extension}`;

const resolveSnapshotTreeRoot = (target: TestCase): string =>
  `${snapshotsRoot}${target.reporter}/${target.runtime}/${runtimePlatform}/${target.name}`;

const read = (target: TestCase): string =>
  readFileSync(resolveSnapshotPath(target), 'utf8');

const write = (target: TestCase, content: string): void => {
  const snapshotPath = resolveSnapshotPath(target);

  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, content);
};

const match = (actual: string, target: TestCase, message?: string): void => {
  if (env.UPDATE_SNAPSHOTS === '1') {
    write(target, actual);
    return;
  }

  const snapshotPath = resolveSnapshotPath(target);
  let expected: string;

  try {
    expected = readFileSync(snapshotPath, 'utf8');
  } catch {
    throw new Error(
      `Snapshot not found at ${snapshotPath}. Run with UPDATE_SNAPSHOTS=1 to create it.`
    );
  }

  strict.equal(actual, expected, message);
};

const collectTreeFiles = (directory: string, accumulator: string[]): void => {
  if (!existsSync(directory)) return;

  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      collectTreeFiles(absolutePath, accumulator);
      continue;
    }

    accumulator.push(absolutePath);
  }
};

const writeTree = (
  treeRoot: string,
  entries: ReadonlyMap<string, string>
): void => {
  rmSync(treeRoot, { recursive: true, force: true });

  for (const [relativePath, content] of entries) {
    const absolutePath = `${treeRoot}/${relativePath}`;

    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
};

const matchTree = (
  actual: ReadonlyMap<string, string>,
  target: TestCase,
  message?: string
): void => {
  const treeRoot = resolveSnapshotTreeRoot(target);

  if (env.UPDATE_SNAPSHOTS === '1') {
    writeTree(treeRoot, actual);
    return;
  }

  const expected = new Map<string, string>();
  const expectedFiles: string[] = [];

  collectTreeFiles(treeRoot, expectedFiles);

  for (const absolutePath of expectedFiles) {
    const relativePath = relative(treeRoot, absolutePath)
      .split(sep)
      .join(posix.sep);

    expected.set(relativePath, readFileSync(absolutePath, 'utf8'));
  }

  strict.deepEqual(actual, expected, message);
};

const matchJson = (
  actual: CoverageSnapshot,
  target: TestCase,
  message?: string
): void => {
  match(`${JSON.stringify(actual, null, 2)}\n`, target, message);
};

export const snapshot = {
  read,
  write,
  match,
  matchJson,
  matchTree,
} as const;
