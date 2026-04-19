import type {
  HtmlBreadcrumbEntry,
  HtmlSummaryChild,
  HtmlWalkInput,
} from '../../@types/html.js';
import type { HtmlHandler, Reporter } from '../../@types/reporters.js';
import type { TreeNode } from '../../@types/tree.js';
import type { Watermarks } from '../../@types/watermarks.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { formatDatetime } from '../../utils/datetime.js';
import { emitDetailPages } from '../shared/html/emit-details.js';
import {
  pagePathForDirectory,
  pagePathForFile,
} from '../shared/html/link-mapper.js';
import {
  metricsForFile,
  metricsForSubtree,
} from '../shared/html/row-metrics.js';
import { htmlRuntimes } from '../shared/html/runtimes/index.js';
import { computeWatermarkClasses } from '../shared/html/watermark-classes.js';
import { shouldHideFileRow } from '../shared/skip.js';
import { buildTree } from '../shared/tree.js';
import { copyAssets } from './copy-assets.js';
import { renderSummaryPage } from './render-summary.js';

const childRelativePath = (
  directoryRelativePath: string,
  segment: string
): string =>
  directoryRelativePath.length === 0
    ? segment
    : posix.join(directoryRelativePath, segment);

const writePage = (
  reportsDir: string,
  pagePath: string,
  html: string
): void => {
  const absolutePath = join(reportsDir, pagePath);

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, html);
};

const buildSummaryChild = (
  childNode: TreeNode,
  directoryRelativePath: string,
  resolvedWatermarks: Watermarks
): HtmlSummaryChild | null => {
  const childRelative = childRelativePath(
    directoryRelativePath,
    childNode.segment
  );

  if (childNode.isFile) {
    if (!childNode.file) return null;

    const metrics = metricsForFile(childNode.file);

    return {
      displayName: childNode.segment,
      relativeLinkPath: pagePathForFile(childRelative),
      metrics,
      watermarkClasses: computeWatermarkClasses(resolvedWatermarks, metrics),
      isEmpty: metrics.lines.total === null,
      isDirectory: false,
    };
  }

  const metrics = metricsForSubtree(childNode);

  return {
    displayName: childNode.segment,
    relativeLinkPath: pagePathForDirectory(childRelative),
    metrics,
    watermarkClasses: computeWatermarkClasses(resolvedWatermarks, metrics),
    isEmpty: metrics.lines.total === null,
    isDirectory: true,
  };
};

const walkDirectory = (
  input: HtmlWalkInput,
  node: TreeNode,
  directoryRelativePath: string,
  breadcrumb: readonly HtmlBreadcrumbEntry[],
  currentLabel: string
): void => {
  const children: HtmlSummaryChild[] = [];
  const pagePath = pagePathForDirectory(directoryRelativePath);
  const metrics = metricsForSubtree(node);

  for (const childNode of node.children) {
    const summaryChild = buildSummaryChild(
      childNode,
      directoryRelativePath,
      input.resolvedWatermarks
    );

    if (summaryChild === null) continue;

    if (
      !summaryChild.isDirectory &&
      shouldHideFileRow(summaryChild.metrics, input.skipFull, input.skipEmpty)
    )
      continue;

    children.push(summaryChild);
  }

  const html = renderSummaryPage({
    title: input.title,
    pagePath,
    breadcrumb,
    currentLabel,
    metrics,
    children,
    resolvedWatermarks: input.resolvedWatermarks,
    datetime: input.datetime,
    runtime: input.runtime,
  });

  writePage(input.reportsDir, pagePath, html);

  const childBreadcrumb: HtmlBreadcrumbEntry[] = [
    ...breadcrumb,
    { label: currentLabel, pagePath },
  ];

  for (const childNode of node.children) {
    if (childNode.isFile) continue;

    walkDirectory(
      input,
      childNode,
      childRelativePath(directoryRelativePath, childNode.segment),
      childBreadcrumb,
      childNode.segment
    );
  }
};

const report: Reporter = (context) => {
  const projectedCoverage = htmlRuntimes[context.runtime].project(context);
  if (projectedCoverage === null) return;

  const { model, byPath } = projectedCoverage;
  if (model.length === 0) return;

  const tree = buildTree(model, context.cwd);
  if (tree.children.length === 0) return;

  mkdirSync(context.reportsDir, { recursive: true });
  copyAssets(context.reportsDir);

  const title = 'All files';
  const datetime = formatDatetime();
  const skipFull = context.options.skipFull === true;
  const skipEmpty = context.options.skipEmpty === true;

  walkDirectory(
    {
      reportsDir: context.reportsDir,
      title,
      resolvedWatermarks: context.watermarks,
      istanbulByPath: byPath,
      skipFull,
      skipEmpty,
      datetime,
      runtime: context.runtime,
    },
    tree,
    '',
    [],
    'All files'
  );

  emitDetailPages(tree, {
    reportsDir: context.reportsDir,
    title,
    rootLabel: 'All files',
    resolvedWatermarks: context.watermarks,
    istanbulByPath: byPath,
    skipFull,
    skipEmpty,
    datetime,
    runtime: context.runtime,
  });
};

export const html: HtmlHandler = { runtimes: htmlRuntimes, report };
