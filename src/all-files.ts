import type { CoverageMap, FileCoverage } from './@types/istanbul.js';
import type { ReporterContext, Runtime } from './@types/reporters.js';
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { nonExecutableLines } from './converters/shared/non-executable-lines.js';
import { fileFilter } from './file-filter.js';
import { relativize, toPosix } from './utils/paths.js';
import { sourceLines as sourceLinesUtil } from './utils/source-lines.js';

const DEFAULT_SOURCE_EXTENSIONS: readonly string[] = [
  '.js',
  '.cjs',
  '.mjs',
  '.ts',
  '.cts',
  '.mts',
  '.tsx',
  '.jsx',
];

const PRUNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
]);

const hasSourceExtension = (
  fileName: string,
  extensions: readonly string[]
): boolean => {
  for (const extension of extensions)
    if (fileName.endsWith(extension)) return true;

  return false;
};

const walkDirectory = (
  directoryPath: string,
  context: ReporterContext,
  extensions: readonly string[],
  collected: Set<string>
): void => {
  let entries;
  try {
    entries = readdirSync(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryName = entry.name;

    if (entry.isDirectory()) {
      if (PRUNED_DIRECTORY_NAMES.has(entryName)) continue;
      if (entryName.startsWith('.')) continue;

      walkDirectory(
        join(directoryPath, entryName),
        context,
        extensions,
        collected
      );

      continue;
    }

    if (!entry.isFile()) continue;
    if (!hasSourceExtension(entryName, extensions)) continue;

    const absolutePath = join(directoryPath, entryName);

    if (!fileFilter.matches(context.userFilter, absolutePath, context.cwd))
      continue;

    collected.add(absolutePath);
  }
};

const resolveSrcRoots = (context: ReporterContext): readonly string[] => {
  const src = context.options.src;
  if (src === undefined) return [context.cwd];

  const list = typeof src === 'string' ? [src] : src;
  return list.map((root) =>
    isAbsolute(root) ? root : resolve(context.cwd, root)
  );
};

const resolveExtensions = (context: ReporterContext): readonly string[] => {
  const extension = context.options.extension;
  if (extension === undefined) return DEFAULT_SOURCE_EXTENSIONS;

  return typeof extension === 'string' ? [extension] : extension;
};

const discover = (context: ReporterContext): Set<string> => {
  const collected = new Set<string>();
  const extensions = resolveExtensions(context);

  for (const root of resolveSrcRoots(context))
    walkDirectory(root, context, extensions, collected);

  return collected;
};

type SourceContents = {
  source: string;
  lines: readonly string[];
};

const readSourceContents = (absolutePath: string): SourceContents | null => {
  try {
    const source = readFileSync(absolutePath, 'utf8');
    return { source, lines: source.split('\n') };
  } catch {
    return null;
  }
};

const collectExecutableLineNumbers = (
  contents: SourceContents
): Set<number> => {
  const commentOnly = sourceLinesUtil.findCommentOnlyLines(contents.source);
  const delimiterOnly = sourceLinesUtil.findDelimiterOnlyLines(contents.source);
  const syntacticallyNonExecutable = nonExecutableLines.find(contents.source);
  const executable = new Set<number>();

  for (let lineIndex = 0; lineIndex < contents.lines.length; lineIndex++) {
    const lineNumber = lineIndex + 1;

    if (contents.lines[lineIndex].trim().length === 0) continue;
    if (commentOnly.has(lineNumber)) continue;
    if (delimiterOnly.has(lineNumber)) continue;
    if (syntacticallyNonExecutable.has(lineNumber)) continue;

    executable.add(lineNumber);
  }

  return executable;
};

const extractExistingSourceFiles = (lcov: string, cwd: string): Set<string> => {
  const paths = new Set<string>();
  const sourceFileRegex = /(?:^|\n)SF:([^\r\n]+)/g;

  let match: RegExpExecArray | null;

  while ((match = sourceFileRegex.exec(lcov)) !== null) {
    const sourcePath = match[1].trim();
    paths.add(isAbsolute(sourcePath) ? sourcePath : resolve(cwd, sourcePath));
  }
  return paths;
};

const buildZeroLcovRecord = (
  cwd: string,
  absolutePath: string,
  contents: SourceContents,
  runtime: Runtime
): string => {
  const lines: string[] = [
    'TN:',
    `SF:${toPosix(relativize(absolutePath, cwd))}`,
    'FNF:0',
    'FNH:0',
  ];

  const executableLineNumbers = collectExecutableLineNumbers(contents);
  const sortedLines = Array.from(executableLineNumbers).sort(
    (left, right) => left - right
  );

  for (const lineNumber of sortedLines) lines.push(`DA:${lineNumber},0`);

  lines.push(`LF:${executableLineNumbers.size}`, 'LH:0');
  if (runtime !== 'bun') lines.push('BRF:0', 'BRH:0');
  lines.push('end_of_record');

  return `${lines.join('\n')}\n`;
};

const injectLcov = (
  lcov: string,
  discovered: ReadonlySet<string>,
  cwd: string,
  runtime: Runtime
): string => {
  if (discovered.size === 0) return lcov;

  const existing = extractExistingSourceFiles(lcov, cwd);
  const appended: string[] = [];

  for (const absolutePath of discovered) {
    if (existing.has(absolutePath)) continue;

    const contents = readSourceContents(absolutePath);
    if (contents === null) continue;

    appended.push(buildZeroLcovRecord(cwd, absolutePath, contents, runtime));
  }

  if (appended.length === 0) return lcov;
  return lcov + appended.join('');
};

const buildZeroFileCoverage = (
  absolutePath: string,
  contents: SourceContents
): FileCoverage => {
  const statementMap: FileCoverage['statementMap'] = Object.create(null);
  const statementCounts: FileCoverage['s'] = Object.create(null);

  const executableLineNumbers = collectExecutableLineNumbers(contents);
  const sortedLines = Array.from(executableLineNumbers).sort(
    (left, right) => left - right
  );

  let statementId = 0;

  for (const lineNumber of sortedLines) {
    const sourceLine = contents.lines[lineNumber - 1];
    const statementKey = String(statementId++);

    statementMap[statementKey] = {
      start: { line: lineNumber, column: 0 },
      end: { line: lineNumber, column: sourceLine.length },
    };

    statementCounts[statementKey] = 0;
  }

  return {
    path: absolutePath,
    all: true,
    statementMap,
    s: statementCounts,
    fnMap: Object.create(null),
    f: Object.create(null),
    branchMap: Object.create(null),
    b: Object.create(null),
  };
};

const injectCoverageMap = (
  coverageMap: CoverageMap,
  discovered: ReadonlySet<string>
): void => {
  for (const absolutePath of discovered) {
    if (coverageMap[absolutePath] !== undefined) continue;

    const contents = readSourceContents(absolutePath);
    if (contents === null) continue;

    coverageMap[absolutePath] = buildZeroFileCoverage(absolutePath, contents);
  }
};

export const allFiles = {
  discover,
  injectLcov,
  injectCoverageMap,
} as const;
