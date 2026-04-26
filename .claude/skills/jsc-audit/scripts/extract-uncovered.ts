#!/usr/bin/env tsx
/*
 * Extract uncovered lines and functions from an lcov.info file.
 *
 * Usage: tsx extract-uncovered.ts <lcov-path> [--lines|--functions]
 *
 * <lcov-path> may be absolute or relative to the current working directory.
 *
 * Default emits both. Output is grouped by source file, one entry per line.
 *
 * Format:
 *   <file>\tline\t<lineNumber>
 *   <file>\tfunction\t<lineNumber>\t<name>
 *
 * Note: lcov produced by Bun-only runs has no branch data (BRF:0 BRH:0).
 * If BRDA records appear, the lcov is contaminated by another engine.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import process from 'node:process';

const rawLcovPath = process.argv[2];
const lcovPath =
  rawLcovPath === undefined
    ? undefined
    : isAbsolute(rawLcovPath)
      ? rawLcovPath
      : resolve(process.cwd(), rawLcovPath);
const flags = new Set(process.argv.slice(3));
const wantAll = !flags.has('--lines') && !flags.has('--functions');
const wantLines = wantAll || flags.has('--lines');
const wantFunctions = wantAll || flags.has('--functions');

if (lcovPath === undefined) {
  console.error(
    'Usage: tsx extract-uncovered.ts <lcov-path> [--lines|--functions]'
  );
  process.exit(1);
}
if (!existsSync(lcovPath)) {
  console.error('lcov file not found:', lcovPath);
  process.exit(1);
}

const text = readFileSync(lcovPath, 'utf8');
const records = text.split(/^end_of_record\s*$/m);

for (const record of records) {
  const lines = record.split(/\r?\n/);
  let file: string | null = null;
  const functionNameToLine = new Map<string, string>();

  for (const line of lines) {
    if (line.startsWith('SF:')) {
      file = line.slice(3);
      continue;
    }
    if (file === null) continue;

    if (line.startsWith('FN:')) {
      const rest = line.slice(3);
      const commaIndex = rest.indexOf(',');
      if (commaIndex < 0) continue;
      const lineNumber = rest.slice(0, commaIndex);
      const name = rest.slice(commaIndex + 1);
      functionNameToLine.set(name, lineNumber);
      continue;
    }

    if (wantFunctions && line.startsWith('FNDA:')) {
      const rest = line.slice(5);
      const commaIndex = rest.indexOf(',');
      if (commaIndex < 0) continue;
      const count = rest.slice(0, commaIndex);
      const name = rest.slice(commaIndex + 1);
      if (count === '0') {
        const lineNumber = functionNameToLine.get(name) ?? '?';
        console.log(`${file}\tfunction\t${lineNumber}\t${name}`);
      }
      continue;
    }

    if (wantLines && line.startsWith('DA:')) {
      const parts = line.slice(3).split(',');
      if (parts[1] === '0') console.log(`${file}\tline\t${parts[0]}`);
      continue;
    }
  }
}
