import type { V8AggregationResult } from '../../@types/aggregation.js';
import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type { SourceMapInput } from '../../@types/source-map.js';
import type {
  FileAggregation,
  PerFileCollection,
  ResolvedScriptSource,
  V8Function,
  V8ScriptCoverage,
} from '../../@types/v8.js';
import { readFileSync } from 'node:fs';
import { offsets } from '../../utils/offsets.js';
import { traceMap } from '../../utils/source-map/index.js';
import { v8Merge } from '../../utils/v8-merge/merge.js';
import { astCache } from '../shared/ast-cache.js';
import { boundaryLines } from '../shared/boundary-lines.js';
import { branchBlocks } from '../shared/branch-blocks.js';
import { functionNames } from '../shared/function-names.js';
import { ignoreDirectives } from '../shared/ignore-directives.js';
import { lineHits } from '../shared/line-hits.js';
import { preRemapFilter } from '../shared/pre-remap-filter.js';
import { sourceMapRemap } from '../shared/remap.js';
import { sourceCache } from '../shared/source-cache.js';
import { v8Discovery } from '../shared/v8-discovery.js';
import { v8Extraction } from './extraction.js';

const recordScriptFunctions = (
  perFile: Map<string, PerFileCollection>,
  filePath: string,
  source: string,
  functions: V8Function[]
): void => {
  let collection = perFile.get(filePath);

  if (!collection) {
    collection = { source, scriptFunctionsFromAllJsons: [] };
    perFile.set(filePath, collection);
  }

  collection.scriptFunctionsFromAllJsons.push(functions);
};

const collectDirectScript = (
  perFile: Map<string, PerFileCollection>,
  resolved: ResolvedScriptSource,
  script: V8ScriptCoverage
): void => {
  if (resolved.filePath === '') return;

  recordScriptFunctions(
    perFile,
    resolved.filePath,
    resolved.source,
    script.functions
  );
};

const collectRemappedScript = (
  perFile: Map<string, PerFileCollection>,
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
    transpiledLineStarts: resolved.transpiledLineStarts,
    traceMapInstance,
    cwd,
  });

  for (const entry of projected)
    recordScriptFunctions(
      perFile,
      entry.originalPath,
      entry.originalSource,
      entry.syntheticScript.functions
    );
};

const extractPerFileAggregation = (
  filePath: string,
  collection: PerFileCollection
): FileAggregation => {
  const mergedFunctions = v8Merge.mergeFunctions(
    collection.scriptFunctionsFromAllJsons
  );
  const syntheticScript: V8ScriptCoverage = {
    scriptId: '',
    url: filePath,
    functions: mergedFunctions,
  };
  const aggregation: FileAggregation = {
    lineHits: new Map(),
    functions: new Map(),
    blocks: [],
  };
  const { source } = collection;
  const lineStartTable = offsets.lineStarts(source);
  const sourceLength = source.length;
  const ignoredLines = ignoreDirectives.parseSource(source);

  aggregation.lineHits = v8Extraction.computeLineHits(source, syntheticScript);
  v8Extraction.absorbFunctions(
    aggregation,
    syntheticScript,
    lineStartTable,
    sourceLength
  );
  boundaryLines.fix(aggregation, source);
  lineHits.applyIgnoredLines(aggregation.lineHits, ignoredLines);

  return aggregation;
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
    lineHits.applyIgnoredBranches(aggregation, ignoredLines);
    lineHits.promoteFromBranches(aggregation);
    functionNames.resolve(aggregation, source);
  }
};

const run = (
  tempDir: string,
  cwd: string,
  resolvedFilter: ResolvedFileFilter
): V8AggregationResult => {
  astCache.reset();

  const fileAggregations = new Map<string, FileAggregation>();
  const sourceByPath = new Map<string, string>();

  const jsonFiles = v8Discovery.findJsonFiles(tempDir);
  if (jsonFiles.length === 0)
    return { aggregations: fileAggregations, sources: sourceByPath };

  const perFile = new Map<string, PerFileCollection>();

  for (const jsonPath of jsonFiles) {
    let content: string;

    try {
      content = readFileSync(jsonPath, 'utf8');
    } catch {
      continue;
    }

    const document = v8Discovery.parseJson(content);

    for (const script of document.scripts) {
      const resolved = sourceCache.resolve({
        script,
        sourceMapCache: document.sourceMapCache,
        cwd,
      });

      if (resolved === undefined) continue;

      if (!preRemapFilter.passes(script, resolved, resolvedFilter, cwd))
        continue;

      if (resolved.sourceMapData !== undefined) {
        collectRemappedScript(perFile, resolved, script, cwd);
      } else {
        collectDirectScript(perFile, resolved, script);
      }
    }
  }

  for (const [filePath, collection] of perFile) {
    fileAggregations.set(
      filePath,
      extractPerFileAggregation(filePath, collection)
    );
    sourceByPath.set(filePath, collection.source);
  }

  finalizeAggregations(fileAggregations, sourceByPath);

  return { aggregations: fileAggregations, sources: sourceByPath };
};

export const v8ToAggregation = { run } as const;
