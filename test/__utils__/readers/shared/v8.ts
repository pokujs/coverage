import type {
  CoverageSnapshot,
  FileSnapshot,
  FunctionHit,
  FunctionRange,
} from '../../../../src/@types/tests.ts';
import type {
  V8NormalizedPayload,
  V8NormalizedScriptCoverage,
} from '../../../../src/@types/v8.js';
import { coverageSnapshot } from './snapshot.ts';

const FIXTURE_ROOT_TOKEN = '<fixtureRoot>';

const stripFixtureRoot = (url: string): string => {
  const fileUrlPrefix = `file://${FIXTURE_ROOT_TOKEN}/`;
  if (url.startsWith(fileUrlPrefix)) return url.slice(fileUrlPrefix.length);

  const bareFileUrl = 'file://';
  if (url.startsWith(bareFileUrl)) return url.slice(bareFileUrl.length);

  return url;
};

const buildFileSnapshot = (
  script: V8NormalizedScriptCoverage
): FileSnapshot => {
  const functionHits: FunctionHit[] = script.functions.map(
    (functionCoverage) => {
      const ranges: FunctionRange[] = functionCoverage.ranges.map((range) => ({
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        count: range.count,
      }));

      return {
        name: functionCoverage.functionName,
        ranges,
      };
    }
  );

  return { functionHits };
};

const parse = (payloads: ReadonlyMap<string, string>): CoverageSnapshot => {
  const files: Record<string, FileSnapshot> = {};

  for (const [, content] of payloads) {
    const payload: V8NormalizedPayload = JSON.parse(content);

    for (const script of payload.result) {
      const normalizedPath = stripFixtureRoot(script.url);

      files[normalizedPath] = buildFileSnapshot(script);
    }
  }

  return {
    reporter: 'v8',
    files: coverageSnapshot.sortFileEntries(files),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const v8Shared = {
  parse,
  formatParsed,
} as const;
