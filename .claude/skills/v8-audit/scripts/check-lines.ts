#!/usr/bin/env tsx
/*
 * Probe V8 raw coverage for one or more lines of a source file.
 *
 * Usage: tsx check-lines.ts <project-root> [<v8-dir>] <relative/file> <line1> [line2] ...
 *
 * <project-root> may be absolute or relative to the current working directory.
 * <v8-dir> is optional; when omitted it defaults to <project-root>/coverage/v8.
 * It is recognized as a directory only when the path exists and is a directory;
 * otherwise the third argument is treated as <relative/file>.
 *
 * Reports for each line: how many V8 dumps loaded the script and how many
 * had a count > 0 in the innermost range covering the line's executable span.
 *
 * Supports two V8 dump formats:
 *
 *   Node/Bun: each JSON groups multiple scripts under `result[]` and embeds
 *   `source-map-cache` so original (line, col) → generated offset must be
 *   probed via @jridgewell/trace-mapping.
 *
 *   Deno: each JSON is a single script with top-level `{ scriptId, url,
 *   functions }`. Offsets are reported directly against the original source
 *   (no transpilation, no source-map). Probe is a direct char→char map.
 *
 * Conventions:
 *   - V8 offsets are character-based (UTF-16 code units), not bytes.
 *   - Probe span = first non-whitespace column to last non-whitespace column.
 *   - "Innermost range" = smallest span among ranges that fully envelope the probe.
 */
import type { SourceMapInput } from '@jridgewell/trace-mapping';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import process from 'node:process';
import { generatedPositionFor, TraceMap } from '@jridgewell/trace-mapping';

type V8Range = {
  startOffset: number;
  endOffset: number;
  count: number;
};

type V8Function = {
  ranges: V8Range[];
};

type V8Script = {
  url: string;
  functions: V8Function[];
};

type V8SourceMapCacheEntry = {
  lineLengths: number[];
  data: SourceMapInput;
};

type V8DocumentNode = {
  result: V8Script[];
  'source-map-cache'?: Record<string, V8SourceMapCacheEntry>;
};

type V8DocumentDeno = V8Script & { scriptId?: unknown };

type V8Document = V8DocumentNode | V8DocumentDeno;

type LineStat = {
  processesLoaded: number;
  processesWithHit: number;
  totalHits: number;
};

type LineProbe = {
  start: number;
  end: number;
};

const rawProjectRoot = process.argv[2];

if (rawProjectRoot === undefined || process.argv.length < 5) {
  console.error(
    'Usage: tsx check-lines.ts <project-root> [<v8-dir>] <relative/file> <line> [line] ...'
  );
  process.exit(1);
}

const projectRoot = isAbsolute(rawProjectRoot)
  ? rawProjectRoot
  : resolve(process.cwd(), rawProjectRoot);

const isExistingDirectory = (candidate: string): boolean => {
  if (!existsSync(candidate)) return false;
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
};

const resolveMaybeRelative = (value: string): string =>
  isAbsolute(value) ? value : resolve(process.cwd(), value);

const thirdArg = process.argv[3]!;
const thirdArgResolved = resolveMaybeRelative(thirdArg);
const thirdArgIsV8Dir = isExistingDirectory(thirdArgResolved);

const v8Dir = thirdArgIsV8Dir
  ? thirdArgResolved
  : join(projectRoot, 'coverage', 'v8');
const relPath = thirdArgIsV8Dir ? process.argv[4] : thirdArg;
const targetLines = process.argv
  .slice(thirdArgIsV8Dir ? 5 : 4)
  .map((value) => Number.parseInt(value, 10));

if (relPath === undefined || targetLines.length === 0) {
  console.error(
    'Usage: tsx check-lines.ts <project-root> [<v8-dir>] <relative/file> <line> [line] ...'
  );
  process.exit(1);
}

const absPath = join(projectRoot, relPath);

if (!existsSync(v8Dir)) {
  console.error('V8 directory not found:', v8Dir);
  process.exit(1);
}
if (!existsSync(absPath)) {
  console.error('Source file not found:', absPath);
  process.exit(1);
}

const source = readFileSync(absPath, 'utf8');
const sourceLines = source.split('\n');
const url = `file://${absPath}`;

// Pre-compute line probes (start, end character offsets in the original source)
// for the direct-mapping case (Deno) and as a baseline for the source-mapped
// path. The source-mapped path overrides these via generatedPositionFor.
const directLineStarts: number[] = [0];
for (let charIndex = 0; charIndex < source.length; charIndex++) {
  if (source.charCodeAt(charIndex) === 0x0a) {
    directLineStarts.push(charIndex + 1);
  }
}

const directLineProbes = new Map<number, LineProbe>();
for (const lineNumber of targetLines) {
  if (lineNumber < 1 || lineNumber > sourceLines.length) continue;
  const lineText = sourceLines[lineNumber - 1];
  if (lineText === undefined || lineText.length === 0) continue;
  const firstCharCol = lineText.search(/\S/);
  if (firstCharCol < 0) continue;
  const lastCharCol = lineText.replace(/\s+$/, '').length - 1;
  const lineStartChar = directLineStarts[lineNumber - 1];
  directLineProbes.set(lineNumber, {
    start: lineStartChar + firstCharCol,
    end: lineStartChar + Math.max(lastCharCol, firstCharCol) + 1,
  });
}

const v8JsonFiles = readdirSync(v8Dir).filter((name) => name.endsWith('.json'));

const stats = new Map<number, LineStat>();
for (const lineNumber of targetLines) {
  stats.set(lineNumber, {
    processesLoaded: 0,
    processesWithHit: 0,
    totalHits: 0,
  });
}

const accumulateRange = (
  lineNumber: number,
  innermostCount: number | null
): void => {
  if (innermostCount === null || innermostCount <= 0) return;
  const stat = stats.get(lineNumber);
  if (stat === undefined) return;
  stat.processesWithHit++;
  stat.totalHits += innermostCount;
};

const findInnermostCount = (
  ranges: readonly V8Range[],
  probe: LineProbe
): number | null => {
  let innermostCount: number | null = null;
  let innermostSpan = Number.POSITIVE_INFINITY;
  for (const range of ranges) {
    if (range.startOffset > probe.start) continue;
    if (range.endOffset < probe.end) continue;
    const span = range.endOffset - range.startOffset;
    if (span < innermostSpan) {
      innermostSpan = span;
      innermostCount = range.count;
    }
  }
  return innermostCount;
};

const isNodeFormat = (document: V8Document): document is V8DocumentNode =>
  Array.isArray((document as V8DocumentNode).result);

const probeNodeBunDocument = (document: V8DocumentNode): void => {
  const script = document.result.find((entry) => entry.url === url);
  if (script === undefined) return;

  const cache = document['source-map-cache']?.[url];
  if (cache === undefined) return;

  const transpiledLineStarts: number[] = [0];
  let cumulative = 0;
  for (const length of cache.lineLengths) {
    cumulative += length + 1;
    transpiledLineStarts.push(cumulative);
  }

  const traceMap = new TraceMap(cache.data);
  const sourceUrl =
    traceMap.resolvedSources.find((entry) => entry === url) ??
    traceMap.resolvedSources[0];

  const ranges = script.functions.flatMap((fn) => fn.ranges);

  for (const lineNumber of targetLines) {
    const stat = stats.get(lineNumber);
    if (stat === undefined) continue;
    stat.processesLoaded++;

    if (lineNumber > sourceLines.length) continue;
    const lineText = sourceLines[lineNumber - 1];
    if (lineText === undefined || lineText.length === 0) continue;

    const firstCharCol = lineText.search(/\S/);
    if (firstCharCol < 0) continue;
    const lastCharCol = lineText.replace(/\s+$/, '').length - 1;

    const genStart = generatedPositionFor(traceMap, {
      source: sourceUrl,
      line: lineNumber,
      column: firstCharCol,
    });
    const genEnd = generatedPositionFor(traceMap, {
      source: sourceUrl,
      line: lineNumber,
      column: Math.max(lastCharCol, firstCharCol),
    });

    if (genStart.line === null || genEnd.line === null) continue;

    const probe: LineProbe = {
      start: transpiledLineStarts[genStart.line - 1] + genStart.column,
      end: transpiledLineStarts[genEnd.line - 1] + genEnd.column + 1,
    };

    accumulateRange(lineNumber, findInnermostCount(ranges, probe));
  }
};

const probeDenoDocument = (document: V8DocumentDeno): void => {
  if (document.url !== url) return;
  const ranges = document.functions.flatMap((fn) => fn.ranges);

  for (const lineNumber of targetLines) {
    const stat = stats.get(lineNumber);
    if (stat === undefined) continue;
    stat.processesLoaded++;

    const probe = directLineProbes.get(lineNumber);
    if (probe === undefined) continue;

    accumulateRange(lineNumber, findInnermostCount(ranges, probe));
  }
};

for (const fileName of v8JsonFiles) {
  let document: V8Document;
  try {
    document = JSON.parse(
      readFileSync(join(v8Dir, fileName), 'utf8')
    ) as V8Document;
  } catch {
    continue;
  }

  if (isNodeFormat(document)) {
    probeNodeBunDocument(document);
  } else {
    probeDenoDocument(document);
  }
}

console.log('File:', relPath);
console.log('Source line count:', sourceLines.length);
console.log();
for (const lineNumber of targetLines) {
  const stat = stats.get(lineNumber)!;
  const lineText = sourceLines[lineNumber - 1] ?? '';
  console.log(
    `L${lineNumber} | loaded=${stat.processesLoaded} hit=${stat.processesWithHit} totalHits=${stat.totalHits} | ${lineText.trim()}`
  );
}
