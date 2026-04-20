import type { ResolvedFileFilter } from '../../@types/file-filter.js';
import type {
  JscAggregationResult,
  JscScriptBlocks,
} from '../../@types/jsc.js';
import type { SourceMapDocument } from '../../@types/source-map.js';
import type { FileAggregation } from '../../@types/v8.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fileFilter } from '../../file-filter.js';
import { offsets } from '../../utils/offsets.js';
import { isBannedPath } from '../../utils/paths.js';
import { sourceMapComment } from '../../utils/source-map-comment.js';
import { traceMap } from '../../utils/source-map/index.js';
import { astCache } from '../shared/ast-cache.js';
import { ignoreDirectives } from '../shared/ignore-directives.js';
import { lineHits } from '../shared/line-hits.js';
import { jscDiscovery } from './discovery.js';
import { jscExtraction } from './extraction.js';
import { aggregationRebase } from './rebase.js';

const SOURCE_MAP_COMMENT_PATTERN = /\n\/\/[@#]\s*sourceMappingURL=/;

const fileUrlFromScriptUrl = (rawUrl: string): string =>
  rawUrl.startsWith('file://') ? rawUrl : pathToFileURL(rawUrl).href;

const absolutePathFromScriptUrl = (rawUrl: string): string =>
  rawUrl.startsWith('file://') ? fileURLToPath(rawUrl) : rawUrl;

const normalizeSourceMapSources = (
  document: SourceMapDocument,
  absoluteScriptPath: string
): SourceMapDocument => {
  if (!Array.isArray(document.sources) || document.sources.length !== 1)
    return document;

  return {
    ...document,
    sources: [absoluteScriptPath],
  };
};

const mergeAggregation = (
  target: FileAggregation,
  source: FileAggregation
): void => {
  lineHits.merge(target.lineHits, source.lineHits);

  for (const [key, functionEntry] of source.functions) {
    if (target.functions.has(key)) continue;

    target.functions.set(key, functionEntry);
  }
};

const trimWrappedSource = (wrappedSource: string): string => {
  const match = SOURCE_MAP_COMMENT_PATTERN.exec(wrappedSource);
  if (match === null) return wrappedSource;

  return wrappedSource.slice(0, match.index + 1);
};

const run = (
  tempDir: string,
  cwd: string,
  preRemapFilter: ResolvedFileFilter
): JscAggregationResult => {
  astCache.reset();

  const blocksFiles = jscDiscovery.findBlocksFiles(tempDir);
  const fileAggregations = new Map<string, FileAggregation>();
  const diskSourceByPath = new Map<string, string>();

  for (const blocksPath of blocksFiles) {
    const scriptBlocks = jscDiscovery.parseBlocksFile(blocksPath);
    if (scriptBlocks === undefined) continue;

    const wrappedSource = scriptBlocks.source;
    const scriptUrl = fileUrlFromScriptUrl(scriptBlocks.url);
    const absoluteScriptPath = absolutePathFromScriptUrl(scriptUrl);

    if (isBannedPath(absoluteScriptPath)) continue;

    const rawSourceMapDocument = sourceMapComment.fromSource(wrappedSource);
    if (rawSourceMapDocument === null) continue;

    const normalizedDocument = normalizeSourceMapSources(
      rawSourceMapDocument,
      absoluteScriptPath
    );

    const traceMapInstance = traceMap.create(normalizedDocument, scriptUrl);

    const diskPath = traceMapInstance.resolvedSources[0];
    if (diskPath === undefined) continue;

    if (!fileFilter.matches(preRemapFilter, diskPath, cwd)) continue;

    const diskSource = traceMapInstance.sourcesContent?.[0];
    if (typeof diskSource !== 'string') continue;

    const trimmedSource = trimWrappedSource(wrappedSource);
    const trimmedLength = trimmedSource.length;
    const wrappedLength = wrappedSource.length;
    const trimmedScriptBlocks: JscScriptBlocks = {
      ...scriptBlocks,
      source: trimmedSource,
      blocks: scriptBlocks.blocks
        .filter((basicBlock) => {
          if (basicBlock.startOffset >= trimmedLength) return false;
          const extendsBeyondTrim = basicBlock.endOffset > trimmedLength;
          const spansEntireWrapped =
            basicBlock.startOffset === 0 &&
            basicBlock.endOffset === wrappedLength;
          return spansEntireWrapped || !extendsBeyondTrim;
        })
        .map((basicBlock) =>
          basicBlock.endOffset > trimmedLength
            ? { ...basicBlock, endOffset: trimmedLength }
            : basicBlock
        ),
    };

    const program = astCache.parse(trimmedSource);
    if (program === null) continue;

    const wrappedLineStartTable = offsets.lineStarts(trimmedSource);
    const wrappedTotalLines = trimmedSource.split('\n').length;
    const functionContainers = jscExtraction.collectFunctionContainers(
      program,
      trimmedSource.length
    );

    const wrappedAggregation: FileAggregation = {
      lineHits: new Map(),
      functions: new Map(),
    };

    lineHits.merge(
      wrappedAggregation.lineHits,
      jscExtraction.computeLineHitsFromBlocks(
        trimmedScriptBlocks,
        functionContainers,
        wrappedLineStartTable,
        wrappedTotalLines
      )
    );

    jscExtraction.absorbBasicBlocks(
      wrappedAggregation,
      program,
      trimmedScriptBlocks,
      wrappedLineStartTable
    );

    for (const functionEntry of wrappedAggregation.functions.values()) {
      if (functionEntry.isModuleFunction) continue;
      if (functionEntry.outerCount > 0) continue;

      const [firstLine, lastLine] = offsets.rangeLines(
        functionEntry.startOffset,
        functionEntry.endOffset,
        wrappedLineStartTable
      );

      for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber++) {
        wrappedAggregation.lineHits.set(lineNumber, 0);
      }
    }

    const diskAggregation = aggregationRebase.toDisk(
      wrappedAggregation,
      traceMapInstance
    );

    let existingAggregation = fileAggregations.get(diskPath);
    if (existingAggregation === undefined) {
      fileAggregations.set(diskPath, diskAggregation);
      diskSourceByPath.set(diskPath, diskSource);
    } else {
      mergeAggregation(existingAggregation, diskAggregation);
    }
  }

  for (const [diskPath, aggregation] of fileAggregations) {
    const diskSource = diskSourceByPath.get(diskPath);
    if (diskSource === undefined) continue;

    for (const [key, functionEntry] of aggregation.functions) {
      if (functionEntry.isModuleFunction) continue;
      if (functionEntry.name === '') aggregation.functions.delete(key);
    }

    const ignoredLines = ignoreDirectives.parseSource(diskSource);

    lineHits.applyIgnoredLines(aggregation.lineHits, ignoredLines);
    lineHits.applyIgnoredBranches(aggregation, ignoredLines);
  }

  return { aggregations: fileAggregations, sources: diskSourceByPath };
};

export const jscToAggregation = { run } as const;
