import type { V8RawDump, V8RawScriptCoverage } from '../../src/@types/tests.ts';

const toPosix = (value: string): string => value.replace(/\\/g, '/');

const normalizeLcov = (content: string, fixtureRoot: string): string => {
  const normalizedEndings = content.replace(/\r\n/g, '\n');
  const prefix = `SF:${fixtureRoot}/`;

  return normalizedEndings
    .split('\n')
    .map((rawLine) =>
      rawLine.startsWith(prefix)
        ? `SF:${rawLine.slice(prefix.length)}`
        : rawLine
    )
    .join('\n');
};

const normalizeHtml = (content: string): string =>
  content
    .replace(/\r\n/g, '\n')
    .replace(/at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, 'at <datetime>')
    .replace(
      /window\.generatedDatetime = "[^"]*"/g,
      'window.generatedDatetime = "<datetime>"'
    );

const normalizeText = (content: string, fixtureRoot?: string): string => {
  const normalizedEndings = content.replace(/\r\n/g, '\n');
  const topLeftIndex = normalizedEndings.indexOf('┌');
  const bottomRightIndex = normalizedEndings.lastIndexOf('┘');

  const extracted =
    topLeftIndex >= 0 && bottomRightIndex > topLeftIndex
      ? normalizedEndings.slice(topLeftIndex, bottomRightIndex + 1)
      : normalizedEndings;

  if (fixtureRoot === undefined) return extracted;

  const fixtureRootPosix = toPosix(fixtureRoot);
  const encodedFixtureRoot = encodeURIComponent(fixtureRoot);
  const encodedFixtureRootPosix = encodeURIComponent(fixtureRootPosix);

  return extracted
    .split(fixtureRoot)
    .join('<fixtureRoot>')
    .split(fixtureRootPosix)
    .join('<fixtureRoot>')
    .split(encodedFixtureRoot)
    .join('<fixtureRoot>')
    .split(encodedFixtureRootPosix)
    .join('<fixtureRoot>');
};

const SUMMARY_HEADER =
  '=============================== Coverage summary ===============================';
const SUMMARY_FOOTER =
  '================================================================================';

const normalizeTextSummary = (content: string): string => {
  const normalizedEndings = content.replace(/\r\n/g, '\n');
  const headerIndex = normalizedEndings.indexOf(SUMMARY_HEADER);
  const footerIndex = normalizedEndings.lastIndexOf(SUMMARY_FOOTER);

  if (headerIndex < 0 || footerIndex <= headerIndex) return normalizedEndings;

  return normalizedEndings.slice(
    headerIndex,
    footerIndex + SUMMARY_FOOTER.length
  );
};

const TEAMCITY_BLOCK_OPENED =
  "##teamcity[blockOpened name='Code Coverage Summary']";
const TEAMCITY_BLOCK_CLOSED =
  "##teamcity[blockClosed name='Code Coverage Summary']";

const normalizeTeamcity = (content: string): string => {
  const normalizedEndings = content.replace(/\r\n/g, '\n');
  const openedIndex = normalizedEndings.indexOf(TEAMCITY_BLOCK_OPENED);
  const closedIndex = normalizedEndings.lastIndexOf(TEAMCITY_BLOCK_CLOSED);

  if (openedIndex < 0 || closedIndex <= openedIndex) return normalizedEndings;

  return normalizedEndings.slice(
    openedIndex,
    closedIndex + TEAMCITY_BLOCK_CLOSED.length
  );
};

const normalizeJsonSummary = (content: string, fixtureRoot: string): string => {
  const normalized = content
    .replace(/\r\n/g, '\n')
    .split(fixtureRoot)
    .join('<fixtureRoot>')
    .replace(
      /\/[^"]*\/test\/__fixtures__\/e2e\/[^/]+\/[^/]+\/[^/"]+/g,
      '<fixtureRoot>'
    );

  const parsed = JSON.parse(normalized) as Record<string, unknown>;
  const sortedKeys = Object.keys(parsed).sort();
  const sortedPayload: Record<string, unknown> = Object.create(null);

  for (const sortedKey of sortedKeys)
    sortedPayload[sortedKey] = parsed[sortedKey];

  return JSON.stringify(sortedPayload, null, 2);
};

const normalizeStringWithFixtureRoot = (
  value: string,
  fixtureRootPosix: string
): string => toPosix(value).split(fixtureRootPosix).join('<fixtureRoot>');

const normalizeJsonValue = (
  value: unknown,
  fixtureRootPosix: string
): unknown => {
  if (typeof value === 'string')
    return normalizeStringWithFixtureRoot(value, fixtureRootPosix);

  if (Array.isArray(value))
    return value.map((item) => normalizeJsonValue(item, fixtureRootPosix));

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    const source = value as Record<string, unknown>;

    for (const key of Object.keys(source)) {
      const normalizedKey = normalizeStringWithFixtureRoot(
        key,
        fixtureRootPosix
      );
      result[normalizedKey] = normalizeJsonValue(source[key], fixtureRootPosix);
    }

    return result;
  }

  return value;
};

const normalizeJson = (content: string, fixtureRoot: string): string => {
  const parsed = JSON.parse(content.replace(/\r\n/g, '\n')) as Record<
    string,
    unknown
  >;
  const fixtureRootPosix = toPosix(fixtureRoot);
  const sortedPayload: Record<string, unknown> = Object.create(null);

  for (const key of Object.keys(parsed).sort()) {
    const normalizedKey = normalizeStringWithFixtureRoot(key, fixtureRootPosix);

    sortedPayload[normalizedKey] = normalizeJsonValue(
      parsed[key],
      fixtureRootPosix
    );
  }

  return JSON.stringify(sortedPayload, null, 2);
};

const extractScripts = (
  parsed: V8RawDump | V8RawScriptCoverage
): V8RawScriptCoverage[] => {
  if ('result' in parsed && Array.isArray(parsed.result)) return parsed.result;
  if ('url' in parsed && 'functions' in parsed) return [parsed];
  return [];
};

const normalizeV8 = (content: string, fixtureRoot: string): string | null => {
  const parsed = JSON.parse(content.replace(/\r\n/g, '\n')) as
    | V8RawDump
    | V8RawScriptCoverage;
  const projectPrefix = `file://${fixtureRoot}/`;

  const projectScripts = extractScripts(parsed).filter((scriptCoverage) =>
    scriptCoverage.url.startsWith(projectPrefix)
  );

  if (projectScripts.length === 0) return null;

  const normalizedScripts = projectScripts.map((scriptCoverage) => {
    const normalizedUrl = `file://<fixtureRoot>/${scriptCoverage.url.slice(projectPrefix.length)}`;

    const normalizedFunctions = scriptCoverage.functions
      .map((functionEntry) => {
        const sortedRanges = [...functionEntry.ranges]
          .sort((left, right) => left.startOffset - right.startOffset)
          .map((range) => ({
            startOffset: range.startOffset,
            endOffset: range.endOffset,
            count: '<count>',
            isBlockCoverage: range.isBlockCoverage,
          }));

        return {
          functionName: functionEntry.functionName,
          ranges: sortedRanges,
          isBlockCoverage: functionEntry.isBlockCoverage,
        };
      })
      .sort((left, right) => {
        const nameCompare = left.functionName.localeCompare(right.functionName);
        if (nameCompare !== 0) return nameCompare;
        return (
          (left.ranges[0]?.startOffset ?? 0) -
          (right.ranges[0]?.startOffset ?? 0)
        );
      });

    return {
      url: normalizedUrl,
      functions: normalizedFunctions,
    };
  });

  normalizedScripts.sort((left, right) => left.url.localeCompare(right.url));

  return JSON.stringify({ result: normalizedScripts }, null, 2);
};

export const paths = {
  normalizeLcov,
  normalizeHtml,
  normalizeText,
  normalizeTextSummary,
  normalizeTeamcity,
  normalizeJsonSummary,
  normalizeJson,
  normalizeV8,
} as const;
