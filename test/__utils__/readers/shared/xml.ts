import { XMLParser } from 'fast-xml-parser';

const FIXTURE_PATH_PATTERN =
  /\/[^<>"'\s]*\/test\/__fixtures__\/e2e\/[^/<>"'\s]+\/[^/<>"'\s]+\/[^/<>"'\s]+/g;

const VOLATILE_ATTRIBUTES = new Set(['timestamp', 'generated']);

const SORT_KEYS_BY_TAG: Record<string, readonly string[]> = {
  class: ['@_filename', '@_name'],
  file: ['@_path', '@_name'],
  package: ['@_name'],
};

const toPosix = (value: string): string => value.replace(/\\/g, '/');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
});

const replaceFixtureRoot = (value: string, fixtureRootPosix: string): string =>
  toPosix(value)
    .split(fixtureRootPosix)
    .join('<fixtureRoot>')
    .replace(FIXTURE_PATH_PATTERN, '<fixtureRoot>');

const normalizeNode = (node: unknown, fixtureRootPosix: string): unknown => {
  if (typeof node === 'string')
    return replaceFixtureRoot(node, fixtureRootPosix);

  if (Array.isArray(node))
    return node.map((child) => normalizeNode(child, fixtureRootPosix));

  if (node !== null && typeof node === 'object') {
    const source = node as Record<string, unknown>;
    const result: Record<string, unknown> = Object.create(null);

    for (const key of Object.keys(source)) {
      const child = source[key];

      if (key.startsWith('@_')) {
        const attributeName = key.slice(2);

        if (VOLATILE_ATTRIBUTES.has(attributeName)) {
          result[key] = `<${attributeName}>`;
          continue;
        }

        result[key] =
          typeof child === 'string'
            ? replaceFixtureRoot(child, fixtureRootPosix)
            : child;
        continue;
      }

      const normalizedChild = normalizeNode(child, fixtureRootPosix);

      if (
        Array.isArray(normalizedChild) &&
        SORT_KEYS_BY_TAG[key] !== undefined
      ) {
        const sortKeys = SORT_KEYS_BY_TAG[key];

        result[key] = [...normalizedChild].sort((left, right) => {
          for (const sortKey of sortKeys) {
            const leftValue = (left as Record<string, unknown>)[sortKey];
            const rightValue = (right as Record<string, unknown>)[sortKey];

            if (typeof leftValue === 'string' && typeof rightValue === 'string')
              return leftValue.localeCompare(rightValue);
          }

          return 0;
        });

        continue;
      }

      result[key] = normalizedChild;
    }

    return result;
  }

  return node;
};

const parse = (content: string): unknown =>
  parser.parse(content.replace(/\r\n/g, '\n'));

const formatParsed = (parsed: unknown, fixtureRoot: string): string => {
  const normalized = normalizeNode(parsed, toPosix(fixtureRoot));

  return JSON.stringify(normalized, null, 2);
};

const toArray = <Item>(
  value: Item | readonly Item[] | undefined
): readonly Item[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value as Item];
};

export const xmlShared = {
  parse,
  formatParsed,
  toArray,
} as const;
