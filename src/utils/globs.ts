/*
 * Minimal glob → regex compiler. Supports `*`, `**`, `?`, brace expansion
 * (including `{,s}`). No character classes, extglob, or negation.
 */

const REGEX_META = /[.+^$()|[\]\\]/g;

const expandBraces = (pattern: string): string[] => {
  const openIndex = pattern.indexOf('{');
  if (openIndex === -1) return [pattern];

  let depth = 1;
  let closeIndex = -1;

  for (let scanIndex = openIndex + 1; scanIndex < pattern.length; scanIndex++) {
    const char = pattern[scanIndex];

    if (char === '{') depth++;
    else if (char === '}') {
      depth--;

      if (depth === 0) {
        closeIndex = scanIndex;
        break;
      }
    }
  }

  if (closeIndex === -1) return [pattern];

  const prefix = pattern.slice(0, openIndex);
  const inner = pattern.slice(openIndex + 1, closeIndex);
  const suffix = pattern.slice(closeIndex + 1);
  const alternatives: string[] = [];

  let currentStart = 0;
  let innerDepth = 0;

  for (let scanIndex = 0; scanIndex < inner.length; scanIndex++) {
    const char = inner[scanIndex];

    if (char === '{') innerDepth++;
    else if (char === '}') innerDepth--;
    else if (char === ',' && innerDepth === 0) {
      alternatives.push(inner.slice(currentStart, scanIndex));
      currentStart = scanIndex + 1;
    }
  }

  alternatives.push(inner.slice(currentStart));

  const expanded: string[] = [];

  for (const alternative of alternatives)
    for (const nested of expandBraces(prefix + alternative + suffix))
      expanded.push(nested);

  return expanded;
};

const globToRegex = (glob: string): RegExp => {
  let source = '^';
  let scanIndex = 0;

  while (scanIndex < glob.length) {
    const char = glob[scanIndex];

    if (char === '*') {
      if (glob[scanIndex + 1] === '*') {
        if (glob[scanIndex + 2] === '/') {
          source += '(?:.*/)?';
          scanIndex += 3;
        } else {
          source += '.*';
          scanIndex += 2;
        }
      } else {
        source += '[^/]*';
        scanIndex += 1;
      }
    } else if (char === '?') {
      source += '[^/]';
      scanIndex += 1;
    } else {
      source += char.replace(REGEX_META, '\\$&');
      scanIndex += 1;
    }
  }

  source += '$';
  return new RegExp(source);
};

const compile = (patterns: readonly string[]): RegExp[] => {
  const compiled: RegExp[] = [];

  for (const pattern of patterns)
    for (const expanded of expandBraces(pattern)) {
      compiled.push(globToRegex(expanded));

      if (!expanded.endsWith('/**'))
        compiled.push(globToRegex(`${expanded}/**`));
    }

  return compiled;
};

const matchesAny = (
  compiledGlobs: readonly RegExp[],
  relativePath: string
): boolean => {
  for (const regex of compiledGlobs) if (regex.test(relativePath)) return true;
  return false;
};

export const globs = { compile, matchesAny } as const;
