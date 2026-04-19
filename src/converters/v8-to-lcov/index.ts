import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type { SourceMapInput } from '../../@types/source-map.js';
import type {
  FileAggregation,
  ResolvedScriptSource,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { readFileSync } from 'node:fs';
import { offsets } from '../../utils/offsets.js';
import { traceMap } from '../../utils/source-map/index.js';
import { astCache } from '../shared/ast-cache.js';
import { branchBlocks } from '../shared/branch-blocks.js';
import { ignoreDirectives } from '../shared/ignore-directives.js';
import { passesPreRemapFilter } from '../shared/pre-remap-filter.js';
import { sourceMapRemap } from '../shared/remap.js';
import { sourceCache } from '../shared/source-cache.js';
import { findV8JsonFiles, parseV8Json } from '../shared/v8-discovery.js';
import {
  absorbFunctions,
  applyIgnoredBranches,
  applyIgnoredLines,
  computeLineHits,
  mergeLineHits,
} from './extraction.js';
import { serializeLcov } from './serialize.js';

const mergeIntoAggregation = (
  aggregations: Map<string, FileAggregation>,
  sourceByPath: Map<string, string>,
  filePath: string,
  source: string,
  script: V8ScriptCoverage
): void => {
  let aggregation = aggregations.get(filePath);

  if (!aggregation) {
    aggregation = {
      lineHits: new Map(),
      functions: new Map(),
    };

    aggregations.set(filePath, aggregation);
  }

  sourceByPath.set(filePath, source);

  const lineStartTable = offsets.lineStarts(source);

  mergeLineHits(aggregation.lineHits, computeLineHits(source, script));
  absorbFunctions(aggregation, script, lineStartTable);

  const ignoredLines = ignoreDirectives.parseSource(source);
  applyIgnoredLines(aggregation.lineHits, ignoredLines);
};

const finalizeAggregations = (
  aggregations: Map<string, FileAggregation>,
  sourceByPath: Map<string, string>
): void => {
  for (const [filePath, aggregation] of aggregations) {
    const source = sourceByPath.get(filePath);
    if (source === undefined) continue;

    const lineStartTable = offsets.lineStarts(source);
    const ignoredLines = ignoreDirectives.parseSource(source);

    branchBlocks.build(aggregation, source, lineStartTable);
    applyIgnoredBranches(aggregation, ignoredLines);
  }
};

const processDirectScript = (
  aggregations: Map<string, FileAggregation>,
  sourceByPath: Map<string, string>,
  resolved: ResolvedScriptSource,
  script: V8ScriptCoverage
): void => {
  if (resolved.filePath === '') return;

  mergeIntoAggregation(
    aggregations,
    sourceByPath,
    resolved.filePath,
    resolved.source,
    script
  );
};

const processRemappedScript = (
  aggregations: Map<string, FileAggregation>,
  sourceByPath: Map<string, string>,
  resolved: ResolvedScriptSource,
  script: V8ScriptCoverage,
  cwd: string
): void => {
  const traceMapInstance = traceMap.create(
    resolved.sourceMapData as SourceMapInput,
    resolved.sourceMapUrl
  );

  const projected = sourceMapRemap.project({
    script,
    transpiledSource: resolved.source,
    traceMapInstance,
    cwd,
  });

  for (const entry of projected) {
    mergeIntoAggregation(
      aggregations,
      sourceByPath,
      entry.originalPath,
      entry.originalSource,
      entry.syntheticScript
    );
  }
};

export const v8ToLcov = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): string => {
  astCache.reset();

  const jsonFiles = findV8JsonFiles(tempDir);
  if (jsonFiles.length === 0) return '';

  const fileAggregations = new Map<string, FileAggregation>();
  const sourceByPath = new Map<string, string>();

  for (const jsonPath of jsonFiles) {
    let content: string;

    try {
      content = readFileSync(jsonPath, 'utf8');
    } catch {
      continue;
    }

    const document = parseV8Json(content);

    for (const script of document.scripts) {
      const resolved = sourceCache.resolve({
        script,
        sourceMapCache: document.sourceMapCache,
        cwd,
      });
      if (resolved === undefined) continue;

      if (!passesPreRemapFilter(script, resolved, preRemapFilter, cwd))
        continue;

      if (resolved.sourceMapData !== undefined) {
        processRemappedScript(
          fileAggregations,
          sourceByPath,
          resolved,
          script,
          cwd
        );
      } else {
        processDirectScript(fileAggregations, sourceByPath, resolved, script);
      }
    }
  }

  finalizeAggregations(fileAggregations, sourceByPath);

  return serializeLcov(fileAggregations, cwd);
};
