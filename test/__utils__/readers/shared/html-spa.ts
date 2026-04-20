import type {
  HtmlSpaRawMetric,
  HtmlSpaRawNode,
} from '../../../../src/@types/html-spa.js';
import type {
  CoverageSnapshot,
  FileSnapshot,
  MetricsBundle,
  SnapshotMetric,
} from '../../../../src/@types/tests.ts';
import { DomUtils, parseDocument } from 'htmlparser2';
import { htmlShared } from './html.ts';
import { coverageSnapshot } from './snapshot.ts';

const WINDOW_DATA_PATTERN =
  /window\.data\s*=\s*(\{[\s\S]*?\});\s*window\.generatedDatetime/;

const extractWindowData = (indexHtml: string): HtmlSpaRawNode => {
  const document = parseDocument(indexHtml);
  const scripts = DomUtils.findAll(
    (node) => node.tagName === 'script',
    DomUtils.getChildren(document)
  );

  for (const script of scripts) {
    const scriptText = DomUtils.textContent(script);
    const match = WINDOW_DATA_PATTERN.exec(scriptText);
    if (!match) continue;

    return JSON.parse(match[1]) as HtmlSpaRawNode;
  }

  throw new Error('window.data not found in html-spa index.html');
};

const buildMetricsBundle = (
  metrics: Record<SnapshotMetric, HtmlSpaRawMetric>
): MetricsBundle => ({
  statements: coverageSnapshot.buildMetricDetail(
    metrics.statements.total,
    metrics.statements.covered
  ),
  branches: coverageSnapshot.buildMetricDetail(
    metrics.branches.total,
    metrics.branches.covered
  ),
  functions: coverageSnapshot.buildMetricDetail(
    metrics.functions.total,
    metrics.functions.covered
  ),
  lines: coverageSnapshot.buildMetricDetail(
    metrics.lines.total,
    metrics.lines.covered
  ),
});

const isSourceFileName = (fileName: string): boolean =>
  fileName.endsWith('.js') || fileName.endsWith('.ts');

const flattenLeafFiles = (
  node: HtmlSpaRawNode,
  pathSegments: readonly string[],
  fileMarkups: ReadonlyMap<string, string>,
  accumulator: Record<string, FileSnapshot>
): void => {
  const currentPath = [...pathSegments, node.file].filter(Boolean).join('/');
  const hasChildren = node.children && node.children.length > 0;

  if (!hasChildren && isSourceFileName(node.file)) {
    const markupKey = `${currentPath}.html`;
    const markup = fileMarkups.get(markupKey);
    const classification = markup
      ? htmlShared.extractFileLines(markup)
      : { covered: [], uncovered: [] };

    accumulator[currentPath] = {
      ...buildMetricsBundle(node.metrics),
      uncoveredLines: coverageSnapshot.compressRanges(classification.uncovered),
      coveredLines: coverageSnapshot.compressRanges(classification.covered),
    };

    return;
  }

  if (!hasChildren) return;

  for (const child of node.children ?? []) {
    flattenLeafFiles(
      child,
      [...pathSegments, node.file].filter(Boolean),
      fileMarkups,
      accumulator
    );
  }
};

const parse = (files: ReadonlyMap<string, string>): CoverageSnapshot => {
  const indexHtml = files.get('index.html');
  if (!indexHtml) {
    return { reporter: 'html-spa' };
  }

  const windowData = extractWindowData(indexHtml);
  const totals = buildMetricsBundle(windowData.metrics);
  const fileSnapshots: Record<string, FileSnapshot> = Object.create(null);

  flattenLeafFiles(windowData, [], files, fileSnapshots);

  return {
    reporter: 'html-spa',
    totals,
    files: coverageSnapshot.sortFileEntries(fileSnapshots),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const htmlSpaShared = {
  parse,
  formatParsed,
} as const;
