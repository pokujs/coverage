import type { Document, Element } from 'domhandler' with {
  'resolution-mode': 'import',
};
import type {
  CoverageSnapshot,
  FileSnapshot,
  Htmlparser2DomUtils,
  LineClassification,
  MetricsBundle,
  SnapshotMetric,
} from '../../../../src/@types/tests.ts';
import { coverageSnapshot } from './snapshot.ts';

const METRIC_LABELS: Record<string, SnapshotMetric> = {
  Statements: 'statements',
  Branches: 'branches',
  Functions: 'functions',
  Lines: 'lines',
};

const hasClass = (
  domUtils: Htmlparser2DomUtils,
  element: Element,
  className: string
): boolean =>
  domUtils
    .getAttributeValue(element, 'class')
    ?.split(/\s+/)
    .includes(className) ?? false;

const parseFraction = (text: string): { covered: number; total: number } => {
  const [coveredPart, totalPart] = text.trim().split('/');

  return { covered: Number(coveredPart), total: Number(totalPart) };
};

const extractMetrics = (
  domUtils: Htmlparser2DomUtils,
  root: Document | Element
): MetricsBundle => {
  const bundle: MetricsBundle = Object.create(null);

  const strongSpans = domUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(domUtils, node, 'strong'),
    domUtils.getChildren(root)
  );

  for (const strong of strongSpans) {
    const labelSpan = domUtils.nextElementSibling(strong);
    if (!labelSpan || !hasClass(domUtils, labelSpan, 'quiet')) continue;

    const label = domUtils.textContent(labelSpan).trim();
    const metric = METRIC_LABELS[label];
    if (!metric) continue;

    const fractionSpan = domUtils.nextElementSibling(labelSpan);
    if (!fractionSpan || !hasClass(domUtils, fractionSpan, 'fraction'))
      continue;

    const { covered, total } = parseFraction(
      domUtils.textContent(fractionSpan)
    );

    bundle[metric] = coverageSnapshot.buildMetricDetail(total, covered);
  }

  return bundle;
};

const extractFilePath = (
  domUtils: Htmlparser2DomUtils,
  root: Document
): string => {
  const [header] = domUtils.findAll(
    (node) => node.tagName === 'h1',
    domUtils.getChildren(root)
  );

  if (!header) return '';

  const anchors = domUtils.findAll(
    (node) => node.tagName === 'a',
    domUtils.getChildren(header)
  );

  const segments: string[] = [];

  for (const anchor of anchors) {
    const anchorText = domUtils.textContent(anchor).trim();
    if (anchorText === 'All files') continue;

    segments.push(anchorText);
  }

  const headerText = domUtils.textContent(header);
  const lastAnchor = anchors[anchors.length - 1];
  const tail = lastAnchor
    ? headerText
        .slice(
          headerText.lastIndexOf(domUtils.textContent(lastAnchor)) +
            domUtils.textContent(lastAnchor).length
        )
        .trim()
    : headerText.trim();

  if (tail) segments.push(tail);

  return segments.join('/');
};

const extractLineClassification = (
  domUtils: Htmlparser2DomUtils,
  root: Document
): LineClassification => {
  const [lineCoverage] = domUtils.findAll(
    (node) =>
      node.tagName === 'td' && hasClass(domUtils, node, 'line-coverage'),
    domUtils.getChildren(root)
  );

  if (!lineCoverage) return { covered: [], uncovered: [] };

  const coverageSpans = domUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(domUtils, node, 'cline-any'),
    domUtils.getChildren(lineCoverage)
  );

  const covered: number[] = [];
  const uncovered: number[] = [];

  coverageSpans.forEach((span: Element, spanIndex: number) => {
    const lineNumber = spanIndex + 1;

    if (hasClass(domUtils, span, 'cline-no')) uncovered.push(lineNumber);
    else if (hasClass(domUtils, span, 'cline-yes')) covered.push(lineNumber);
  });

  return { covered, uncovered };
};

const isSourceFile = (relativePath: string): boolean =>
  relativePath.endsWith('.js.html') || relativePath.endsWith('.ts.html');

const parse = async (
  files: ReadonlyMap<string, string>
): Promise<CoverageSnapshot> => {
  const { DomUtils, parseDocument } = await import('htmlparser2');
  const rootMarkup = files.get('index.html');
  const fileSnapshots: Record<string, FileSnapshot> = Object.create(null);
  const totals = rootMarkup
    ? extractMetrics(DomUtils, parseDocument(rootMarkup))
    : Object.create(null);

  for (const [relativePath, content] of files) {
    if (!isSourceFile(relativePath)) continue;

    const parsedRoot = parseDocument(content);

    const sourcePath = extractFilePath(DomUtils, parsedRoot);
    if (!sourcePath) continue;

    const metrics = extractMetrics(DomUtils, parsedRoot);
    const { covered, uncovered } = extractLineClassification(
      DomUtils,
      parsedRoot
    );

    fileSnapshots[sourcePath] = {
      ...metrics,
      uncoveredLines: coverageSnapshot.compressRanges(uncovered),
      coveredLines: coverageSnapshot.compressRanges(covered),
    };
  }

  return {
    reporter: 'html',
    totals,
    files: coverageSnapshot.sortFileEntries(fileSnapshots),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

const extractFileLines = async (
  fileMarkup: string
): Promise<LineClassification> => {
  const { DomUtils, parseDocument } = await import('htmlparser2');
  return extractLineClassification(DomUtils, parseDocument(fileMarkup));
};

export const htmlShared = {
  parse,
  formatParsed,
  extractFileLines,
} as const;
