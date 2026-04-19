import type { Document, Element } from 'domhandler';
import type {
  HtmlSnapshot,
  HtmlSnapshotFileMetrics,
  HtmlSnapshotMetric,
  HtmlSnapshotSummary,
} from '../../../src/@types/tests.ts';
import { readdirSync, readFileSync } from 'node:fs';
import { posix, relative, sep } from 'node:path';
import { DomUtils, parseDocument } from 'htmlparser2';
import { paths } from '../paths.ts';

const METRIC_LABELS: Record<string, HtmlSnapshotMetric> = {
  Statements: 'statements',
  Branches: 'branches',
  Functions: 'functions',
  Lines: 'lines',
};

const emptySummary = (): HtmlSnapshotSummary => ({
  statements: '',
  branches: '',
  functions: '',
  lines: '',
});

const hasClass = (element: Element, className: string): boolean =>
  DomUtils.getAttributeValue(element, 'class')
    ?.split(/\s+/)
    .includes(className) ?? false;

const extractMetrics = (root: Document | Element): HtmlSnapshotSummary => {
  const summary = emptySummary();

  const strongSpans = DomUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(node, 'strong'),
    DomUtils.getChildren(root)
  );

  for (const strong of strongSpans) {
    const sibling = DomUtils.nextElementSibling(strong);
    if (!sibling || !hasClass(sibling, 'quiet')) continue;

    const label = DomUtils.textContent(sibling).trim();
    const metric = METRIC_LABELS[label];
    if (!metric) continue;

    summary[metric] = DomUtils.textContent(strong).trim();
  }

  return summary;
};

const extractFilePath = (root: Document): string => {
  const [header] = DomUtils.findAll(
    (node) => node.tagName === 'h1',
    DomUtils.getChildren(root)
  );
  if (!header) return '';

  const anchors = DomUtils.findAll(
    (node) => node.tagName === 'a',
    DomUtils.getChildren(header)
  );
  const segments: string[] = [];

  for (const anchor of anchors) {
    const anchorText = DomUtils.textContent(anchor).trim();
    if (anchorText === 'All files') continue;
    segments.push(anchorText);
  }

  const headerText = DomUtils.textContent(header);
  const lastAnchor = anchors[anchors.length - 1];
  const tail = lastAnchor
    ? headerText
        .slice(
          headerText.lastIndexOf(DomUtils.textContent(lastAnchor)) +
            DomUtils.textContent(lastAnchor).length
        )
        .trim()
    : headerText.trim();

  if (tail) segments.push(tail);

  return segments.join('/');
};

const compressRanges = (lineNumbers: readonly number[]): string => {
  if (lineNumbers.length === 0) return '';

  const parts: string[] = [];
  let rangeStart = lineNumbers[0];
  let previousLine = lineNumbers[0];

  const flush = () => {
    parts.push(
      rangeStart === previousLine
        ? `${rangeStart}`
        : `${rangeStart}-${previousLine}`
    );
  };

  for (let rangeIndex = 1; rangeIndex < lineNumbers.length; rangeIndex += 1) {
    const currentLine = lineNumbers[rangeIndex];

    if (currentLine === previousLine + 1) {
      previousLine = currentLine;
      continue;
    }

    flush();
    rangeStart = currentLine;
    previousLine = currentLine;
  }

  flush();

  return parts.join(',');
};

const extractUncoveredLines = (root: Document): string => {
  const [lineCoverage] = DomUtils.findAll(
    (node) => node.tagName === 'td' && hasClass(node, 'line-coverage'),
    DomUtils.getChildren(root)
  );
  if (!lineCoverage) return '';

  const coverageSpans = DomUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(node, 'cline-any'),
    DomUtils.getChildren(lineCoverage)
  );

  const uncoveredLines: number[] = [];

  coverageSpans.forEach((coverageSpan, spanIndex) => {
    if (hasClass(coverageSpan, 'cline-no')) uncoveredLines.push(spanIndex + 1);
  });

  return compressRanges(uncoveredLines);
};

const collectHtmlFiles = (
  directory: string,
  coverageRoot: string,
  accumulator: Map<string, string>,
  normalize: (content: string) => string
): void => {
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = `${directory}/${entry.name}`;

    if (entry.isDirectory()) {
      collectHtmlFiles(absolutePath, coverageRoot, accumulator, normalize);
      continue;
    }

    if (!entry.name.endsWith('.html')) continue;

    const relativePath = relative(coverageRoot, absolutePath)
      .split(sep)
      .join(posix.sep);

    accumulator.set(
      relativePath,
      normalize(readFileSync(absolutePath, 'utf8'))
    );
  }
};

const resolveCoverageRoot = (fixtureRoot: string, subdir: string): string =>
  subdir === ''
    ? `${fixtureRoot}/coverage`
    : `${fixtureRoot}/coverage/${subdir}`;

const read = (fixtureRoot: string, subdir = ''): Map<string, string> => {
  const coverageRoot = resolveCoverageRoot(fixtureRoot, subdir);
  const accumulator = new Map<string, string>();

  collectHtmlFiles(
    coverageRoot,
    coverageRoot,
    accumulator,
    paths.normalizeHtml
  );

  return accumulator;
};

const isSourceFile = (relativePath: string): boolean =>
  relativePath.endsWith('.js.html') || relativePath.endsWith('.ts.html');

const passthrough = (content: string): string => content;

const extract = (fixtureRoot: string, subdir = ''): HtmlSnapshot => {
  const coverageRoot = resolveCoverageRoot(fixtureRoot, subdir);
  const rawFiles = new Map<string, string>();
  collectHtmlFiles(coverageRoot, coverageRoot, rawFiles, passthrough);

  const rootMarkup = rawFiles.get('index.html');
  const summary = rootMarkup
    ? extractMetrics(parseDocument(rootMarkup))
    : emptySummary();

  const files: Record<string, HtmlSnapshotFileMetrics> = {};
  const sortedEntries = [...rawFiles.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );

  for (const [relativePath, content] of sortedEntries) {
    if (!isSourceFile(relativePath)) continue;

    const parsedRoot = parseDocument(content);
    const sourcePath = extractFilePath(parsedRoot);
    if (!sourcePath) continue;

    const fileMetrics = extractMetrics(parsedRoot);
    files[sourcePath] = {
      statements: fileMetrics.statements,
      branches: fileMetrics.branches,
      functions: fileMetrics.functions,
      lines: fileMetrics.lines,
      uncoveredLines: extractUncoveredLines(parsedRoot),
    };
  }

  return { summary, files };
};

export const html = {
  extract,
  read,
} as const;
