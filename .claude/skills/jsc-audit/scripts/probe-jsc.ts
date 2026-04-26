#!/usr/bin/env tsx
/*
 * Probe a JSC raw dump for one or more lines of a source file.
 *
 * Usage: tsx probe-jsc.ts <project-root> [<jsc-dir>] <relative/file> <line1> [line2] ...
 *
 * <project-root> may be absolute or relative to the current working directory.
 * <jsc-dir> is optional; when omitted it defaults to <project-root>/coverage/jsc.
 * It is recognized as a directory only when the path exists and is a directory;
 * otherwise the third argument is treated as <relative/file>.
 *
 * For each requested line, the script:
 *   - Locates the .jsc.json dump whose `url` matches <project-root>/<file>.
 *   - Decodes the inline source-map appended to dump.source.
 *   - Maps (line, firstNonWhitespaceCol)..(line, lastNonWhitespaceCol) from the
 *     original source to a [start, end] range in the transpiled dump.source.
 *   - Lists every block in dump.blocks that has any non-empty intersection
 *     with that range, marking each as `envelops` (covers the line range
 *     entirely) or `intersects` (covers only part of it; the overlapping
 *     transpiled offsets are printed alongside). For each block,
 *     executionCount and hasExecuted are reported as JSC emitted them.
 *
 * The script does not pick a "best" block, does not filter blocks by span,
 * and does not derive a verdict. It reports the raw JSC data; interpretation
 * is the caller's job. Partial-intersection blocks are essential for JSC
 * audits because sub-statement blocks (catch arms, ternary branches, dead
 * returns) often appear as count=0 sub-blocks that intersect a line without
 * enveloping it.
 *
 * Two layouts are supported for <jsc-dir>:
 *   - flat:   <jsc-dir>/*.jsc.json
 *   - nested: <jsc-dir>/<sub>/*.jsc.json
 */
import type {
  GeneratedMapping,
  InvalidGeneratedMapping,
  SourceMapInput,
} from '@jridgewell/trace-mapping';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import {
  generatedPositionFor,
  LEAST_UPPER_BOUND,
  TraceMap,
} from '@jridgewell/trace-mapping';

type JscBasicBlock = {
  startOffset: number;
  endOffset: number;
  hasExecuted: boolean;
  executionCount: number;
};

type JscScriptDump = {
  url: string;
  scriptId: string;
  source: string;
  blocks: JscBasicBlock[];
};

const rawProjectRoot = process.argv[2];

if (rawProjectRoot === undefined || process.argv.length < 5) {
  console.error(
    'Usage: tsx probe-jsc.ts <project-root> [<jsc-dir>] <relative/file> <line> [line] ...'
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
const thirdArgIsJscDir = isExistingDirectory(thirdArgResolved);

const jscDir = thirdArgIsJscDir
  ? thirdArgResolved
  : join(projectRoot, 'coverage', 'jsc');
const relPath = thirdArgIsJscDir ? process.argv[4] : thirdArg;
const targetLines = process.argv
  .slice(thirdArgIsJscDir ? 5 : 4)
  .map((value) => Number.parseInt(value, 10));

if (relPath === undefined || targetLines.length === 0) {
  console.error(
    'Usage: tsx probe-jsc.ts <project-root> [<jsc-dir>] <relative/file> <line> [line] ...'
  );
  process.exit(1);
}

const absSourcePath = join(projectRoot, relPath);

if (!existsSync(jscDir)) {
  console.error('JSC directory not found:', jscDir);
  process.exit(1);
}
if (!existsSync(absSourcePath)) {
  console.error('Source file not found:', absSourcePath);
  process.exit(1);
}

const collectJscDumps = (root: string): string[] => {
  const collected: string[] = [];
  for (const entryName of readdirSync(root)) {
    const entryPath = join(root, entryName);
    let entryStat;
    try {
      entryStat = statSync(entryPath);
    } catch {
      continue;
    }
    if (entryStat.isFile() && entryName.endsWith('.jsc.json')) {
      collected.push(entryPath);
      continue;
    }
    if (!entryStat.isDirectory()) continue;
    let subEntries: string[];
    try {
      subEntries = readdirSync(entryPath);
    } catch {
      continue;
    }
    for (const subEntry of subEntries) {
      if (!subEntry.endsWith('.jsc.json')) continue;
      collected.push(join(entryPath, subEntry));
    }
  }
  return collected;
};

const findDumpForFile = (): { path: string; dump: JscScriptDump } | null => {
  for (const dumpPath of collectJscDumps(jscDir)) {
    let dump: JscScriptDump;
    try {
      dump = JSON.parse(readFileSync(dumpPath, 'utf8')) as JscScriptDump;
    } catch {
      continue;
    }
    if (dump.url === absSourcePath) return { path: dumpPath, dump };
  }
  return null;
};

const SOURCE_MAP_PATTERN =
  /\/\/[#@]\s*sourceMappingURL=data:application\/json(?:;charset=[^;]+)?;base64,([A-Za-z0-9+/=]+)\s*$/m;

const decodeInlineSourceMap = (
  transpiledSource: string
): SourceMapInput | null => {
  const match = transpiledSource.match(SOURCE_MAP_PATTERN);
  if (match === null) return null;
  try {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    return JSON.parse(decoded) as SourceMapInput;
  } catch {
    return null;
  }
};

const source = readFileSync(absSourcePath, 'utf8');
const sourceLines = source.split('\n');

console.log('File:', relPath);

const located = findDumpForFile();

if (located === null) {
  console.log('Dump: not found');
  process.exit(0);
}

const dumpRelPath = relative(process.cwd(), located.path);
console.log('Dump:', dumpRelPath);

const sourceMapInput = decodeInlineSourceMap(located.dump.source);

if (sourceMapInput === null) {
  console.error('Source map missing in dump for', relPath);
  process.exit(1);
}

const traceMap = new TraceMap(sourceMapInput);
const sourceUrl =
  traceMap.resolvedSources.find((entry) => entry.endsWith(relPath)) ??
  traceMap.resolvedSources[0];

const transpiledLines = located.dump.source.split('\n');
const transpiledLineStarts: number[] = [0];
let cumulativeOffset = 0;
for (const lineText of transpiledLines) {
  cumulativeOffset += lineText.length + 1;
  transpiledLineStarts.push(cumulativeOffset);
}

const mapColumnRobust = (
  originalLine: number,
  originalColumn: number
): GeneratedMapping | InvalidGeneratedMapping => {
  const greatestLowerBound = generatedPositionFor(traceMap, {
    source: sourceUrl,
    line: originalLine,
    column: originalColumn,
  });
  if (greatestLowerBound.line !== null) return greatestLowerBound;

  return generatedPositionFor(traceMap, {
    source: sourceUrl,
    line: originalLine,
    column: originalColumn,
    bias: LEAST_UPPER_BOUND,
  });
};

const transpiledOffsetForMapping = (mapping: GeneratedMapping): number =>
  transpiledLineStarts[mapping.line - 1] + mapping.column;

const lineEndOffset = (transpiledLine: number): number => {
  const nextLineStart = transpiledLineStarts[transpiledLine];
  if (nextLineStart === undefined) return located.dump.source.length;
  return nextLineStart - 1;
};

const formatIntersectingBlocks = (
  probeStart: number,
  probeEnd: number
): void => {
  const intersecting = located.dump.blocks.filter(
    (block) => block.endOffset > probeStart && block.startOffset < probeEnd
  );
  console.log(`  Intersecting blocks: ${intersecting.length}`);
  for (const block of intersecting) {
    const envelops =
      block.startOffset <= probeStart && block.endOffset >= probeEnd;
    const relation = envelops ? 'envelops  ' : 'intersects';
    const overlapStart = Math.max(block.startOffset, probeStart);
    const overlapEnd = Math.min(block.endOffset, probeEnd);
    const overlapNote = envelops
      ? ''
      : `  (covers transpiled offsets [${overlapStart}, ${overlapEnd}])`;
    console.log(
      `    ${relation}  [${block.startOffset}, ${block.endOffset}]    executionCount=${block.executionCount}  hasExecuted=${block.hasExecuted}${overlapNote}`
    );
  }
};

for (const lineNumber of targetLines) {
  const lineText = sourceLines[lineNumber - 1] ?? '';
  console.log();
  console.log(`Line ${lineNumber}: ${JSON.stringify(lineText)}`);

  if (lineNumber < 1 || lineNumber > sourceLines.length) {
    console.log('  Line number out of range');
    continue;
  }
  if (lineText.length === 0) {
    console.log('  Empty line (no executable position to probe)');
    continue;
  }
  const firstNonWhitespaceColumn = lineText.search(/\S/);
  if (firstNonWhitespaceColumn < 0) {
    console.log('  Whitespace-only line');
    continue;
  }
  const lastNonWhitespaceColumn = lineText.replace(/\s+$/, '').length - 1;

  const mappingStart = mapColumnRobust(lineNumber, firstNonWhitespaceColumn);
  const mappingEnd = mapColumnRobust(
    lineNumber,
    Math.max(lastNonWhitespaceColumn, firstNonWhitespaceColumn)
  );

  if (mappingStart.line === null && mappingEnd.line === null) {
    console.log('  Could not map original position to transpiled source');
    continue;
  }

  const annotations: string[] = [];
  let probeStart: number;
  let probeEnd: number;

  if (mappingStart.line !== null && mappingEnd.line === null) {
    probeStart = transpiledOffsetForMapping(mappingStart);
    probeEnd = lineEndOffset(mappingStart.line);
    annotations.push('end-clamped');
  } else if (mappingStart.line === null && mappingEnd.line !== null) {
    probeStart = transpiledLineStarts[mappingEnd.line - 1];
    probeEnd = transpiledOffsetForMapping(mappingEnd) + 1;
    annotations.push('start-clamped');
  } else {
    const validStart = mappingStart as GeneratedMapping;
    const validEnd = mappingEnd as GeneratedMapping;
    probeStart = transpiledOffsetForMapping(validStart);
    const rawProbeEnd = transpiledOffsetForMapping(validEnd) + 1;
    const startLineEnd = lineEndOffset(validStart.line);
    if (rawProbeEnd > startLineEnd) {
      probeEnd = startLineEnd;
      annotations.push('cross-line clamped');
    } else {
      probeEnd = rawProbeEnd;
    }
  }

  const annotationSuffix =
    annotations.length === 0 ? '' : ` (${annotations.join(', ')})`;
  console.log(
    `  Mapped to transpiled offsets [${probeStart}, ${probeEnd}]${annotationSuffix}`
  );
  formatIntersectingBlocks(probeStart, probeEnd);
}
