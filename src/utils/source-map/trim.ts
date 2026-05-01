import type {
  EncodedSourceMap,
  SourceMapSegment,
} from '../../@types/source-map.js';
import { SOURCES_INDEX } from './segment.js';
import { encodeMappings } from './vlq-encode.js';
import { decodeMappings } from './vlq.js';

const keepOnly = (
  map: EncodedSourceMap,
  targetIndex: number
): EncodedSourceMap => {
  if (targetIndex < 0 || targetIndex >= map.sources.length)
    throw new Error(
      `sourceMapTrim.keepOnly: targetIndex ${targetIndex} out of range for sources.length ${map.sources.length}`
    );

  const decoded = decodeMappings(map.mappings);
  const trimmedLines: SourceMapSegment[][] = new Array(decoded.length);

  for (let lineIndex = 0; lineIndex < decoded.length; lineIndex++) {
    const lineSegments = decoded[lineIndex];
    const keptSegments: SourceMapSegment[] = [];

    for (
      let segmentIndex = 0;
      segmentIndex < lineSegments.length;
      segmentIndex++
    ) {
      const segment = lineSegments[segmentIndex];

      if (segment.length === 1) continue;
      if (segment[SOURCES_INDEX] !== targetIndex) continue;
      if (segment.length === 4) {
        keptSegments.push([segment[0], 0, segment[2], segment[3]]);
        continue;
      }

      keptSegments.push([segment[0], 0, segment[2], segment[3], segment[4]]);
    }

    trimmedLines[lineIndex] = keptSegments;
  }

  const trimmedSourcesContent =
    map.sourcesContent === undefined
      ? undefined
      : [map.sourcesContent[targetIndex] ?? null];

  const trimmed: EncodedSourceMap = {
    version: 3,
    names: map.names,
    sources: [map.sources[targetIndex]],
    mappings: encodeMappings(trimmedLines),
  };

  if (map.file !== undefined) trimmed.file = map.file;
  if (map.sourceRoot !== undefined) trimmed.sourceRoot = map.sourceRoot;
  if (trimmedSourcesContent !== undefined)
    trimmed.sourcesContent = trimmedSourcesContent;
  if (map.ignoreList !== undefined)
    trimmed.ignoreList = map.ignoreList.includes(targetIndex) ? [0] : [];

  return trimmed;
};

export const sourceMapTrim = { keepOnly } as const;
