import type { Document, Element } from 'domhandler';
import type {
  CoverageSnapshot,
  FileSnapshot,
  LineClassification,
  MetricsBundle,
  SnapshotMetric,
} from '../../../../src/@types/tests.ts';
import { DomUtils, parseDocument } from 'htmlparser2';
import { coverageSnapshot } from './snapshot.ts';

const METRIC_LABELS: Record<string, SnapshotMetric> = {
  Statements: 'statements',
  Branches: 'branches',
  Functions: 'functions',
  Lines: 'lines',
};

const hasClass = (element: Element, className: string): boolean =>
  DomUtils.getAttributeValue(element, 'class')
    ?.split(/\s+/)
    .includes(className) ?? false;

const parseFraction = (text: string): { covered: number; total: number } => {
  const [coveredPart, totalPart] = text.trim().split('/');

  return { covered: Number(coveredPart), total: Number(totalPart) };
};

const extractMetrics = (root: Document | Element): MetricsBundle => {
  const bundle: MetricsBundle = {};

  const strongSpans = DomUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(node, 'strong'),
    DomUtils.getChildren(root)
  );

  for (const strong of strongSpans) {
    const labelSpan = DomUtils.nextElementSibling(strong);
    if (!labelSpan || !hasClass(labelSpan, 'quiet')) continue;

    const label = DomUtils.textContent(labelSpan).trim();
    const metric = METRIC_LABELS[label];
    if (!metric) continue;

    const fractionSpan = DomUtils.nextElementSibling(labelSpan);
    if (!fractionSpan || !hasClass(fractionSpan, 'fraction')) continue;

    const { covered, total } = parseFraction(
      DomUtils.textContent(fractionSpan)
    );

    bundle[metric] = coverageSnapshot.buildMetricDetail(total, covered);
  }

  return bundle;
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

const extractLineClassification = (root: Document): LineClassification => {
  const [lineCoverage] = DomUtils.findAll(
    (node) => node.tagName === 'td' && hasClass(node, 'line-coverage'),
    DomUtils.getChildren(root)
  );

  if (!lineCoverage) return { covered: [], uncovered: [] };

  const coverageSpans = DomUtils.findAll(
    (node) => node.tagName === 'span' && hasClass(node, 'cline-any'),
    DomUtils.getChildren(lineCoverage)
  );

  const covered: number[] = [];
  const uncovered: number[] = [];

  coverageSpans.forEach((span, spanIndex) => {
    const lineNumber = spanIndex + 1;

    if (hasClass(span, 'cline-no')) uncovered.push(lineNumber);
    else if (hasClass(span, 'cline-yes')) covered.push(lineNumber);
  });

  return { covered, uncovered };
};

const isSourceFile = (relativePath: string): boolean =>
  relativePath.endsWith('.js.html') || relativePath.endsWith('.ts.html');

const parse = (files: ReadonlyMap<string, string>): CoverageSnapshot => {
  const rootMarkup = files.get('index.html');
  const totals = rootMarkup ? extractMetrics(parseDocument(rootMarkup)) : {};

  const fileSnapshots: Record<string, FileSnapshot> = {};

  for (const [relativePath, content] of files) {
    if (!isSourceFile(relativePath)) continue;

    const parsedRoot = parseDocument(content);

    const sourcePath = extractFilePath(parsedRoot);
    if (!sourcePath) continue;

    const metrics = extractMetrics(parsedRoot);
    const { covered, uncovered } = extractLineClassification(parsedRoot);

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

const extractFileLines = (fileMarkup: string): LineClassification =>
  extractLineClassification(parseDocument(fileMarkup));

export const htmlShared = {
  parse,
  formatParsed,
  extractFileLines,
} as const;
