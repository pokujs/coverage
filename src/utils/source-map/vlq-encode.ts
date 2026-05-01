/*
 * Adapted from @jridgewell/sourcemap-codec's `vlq.ts` and `sourcemap-codec.ts`.
 * Original: https://github.com/jridgewell/sourcemaps
 * Copyright 2024 Justin Ridgewell
 * MIT License
 */

import type { SourceMapSegment } from '../../@types/source-map.js';

const BASE64_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const INT_TO_CHAR = new Uint8Array(64);

for (let charsetIndex = 0; charsetIndex < BASE64_CHARSET.length; charsetIndex++)
  INT_TO_CHAR[charsetIndex] = BASE64_CHARSET.charCodeAt(charsetIndex);

const COMMA_CODE = 44;
const SEMICOLON_CODE = 59;

const encodeSignedNumber = (byteBuffer: number[], value: number): void => {
  let payload = value < 0 ? (-value << 1) | 1 : value << 1;

  do {
    let vlqUnit = payload & 0b011111;
    payload >>>= 5;

    if (payload > 0) vlqUnit |= 0b100000;

    byteBuffer.push(INT_TO_CHAR[vlqUnit]);
  } while (payload > 0);
};

const FLUSH_CHUNK_SIZE = 16 * 1024;

const flushChunk = (chunk: number[]): string => {
  const text = String.fromCharCode.apply(null, chunk);

  chunk.length = 0;

  return text;
};

export const encodeMappings = (
  decodedMappings: readonly (readonly SourceMapSegment[])[]
): string => {
  const chunk: number[] = [];
  const segments: string[] = [];

  let previousSourcesIndex = 0;
  let previousSourceLine = 0;
  let previousSourceColumn = 0;
  let previousNamesIndex = 0;

  for (let lineIndex = 0; lineIndex < decodedMappings.length; lineIndex++) {
    if (lineIndex > 0) chunk.push(SEMICOLON_CODE);

    const lineSegments = decodedMappings[lineIndex];
    let previousGeneratedColumn = 0;

    for (
      let segmentIndex = 0;
      segmentIndex < lineSegments.length;
      segmentIndex++
    ) {
      const segment = lineSegments[segmentIndex];

      if (segmentIndex > 0) chunk.push(COMMA_CODE);

      const generatedColumn = segment[0];

      encodeSignedNumber(chunk, generatedColumn - previousGeneratedColumn);

      previousGeneratedColumn = generatedColumn;

      if (segment.length === 1) {
        if (chunk.length >= FLUSH_CHUNK_SIZE) segments.push(flushChunk(chunk));
        continue;
      }

      const sourcesIndex = segment[1];
      const sourceLine = segment[2];
      const sourceColumn = segment[3];

      encodeSignedNumber(chunk, sourcesIndex - previousSourcesIndex);
      encodeSignedNumber(chunk, sourceLine - previousSourceLine);
      encodeSignedNumber(chunk, sourceColumn - previousSourceColumn);

      previousSourcesIndex = sourcesIndex;
      previousSourceLine = sourceLine;
      previousSourceColumn = sourceColumn;

      if (segment.length === 5) {
        const namesIndex = segment[4];

        encodeSignedNumber(chunk, namesIndex - previousNamesIndex);

        previousNamesIndex = namesIndex;
      }

      if (chunk.length >= FLUSH_CHUNK_SIZE) segments.push(flushChunk(chunk));
    }
  }

  if (chunk.length > 0) segments.push(flushChunk(chunk));
  return segments.join('');
};
