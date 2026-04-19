import type {
  HtmlBreadcrumbEntry,
  HtmlDetailEmissionInput,
} from '../../../@types/html.js';
import type { TreeNode } from '../../../@types/tree.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { shouldHideFileRow } from '../skip.js';
import { pagePathForDirectory, pagePathForFile } from './link-mapper.js';
import { renderDetailPageLineOnly } from './render-detail-line-only.js';
import { renderDetailPage } from './render-detail.js';
import { metricsForFile } from './row-metrics.js';

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

const walkForDetails = (
  input: HtmlDetailEmissionInput,
  node: TreeNode,
  directoryRelativePath: string,
  breadcrumb: readonly HtmlBreadcrumbEntry[],
  currentLabel: string
): void => {
  const pagePath = pagePathForDirectory(directoryRelativePath);

  const childBreadcrumb: HtmlBreadcrumbEntry[] = [
    ...breadcrumb,
    { label: currentLabel, pagePath },
  ];

  for (const childNode of node.children) {
    const childRelative = childRelativePath(
      directoryRelativePath,
      childNode.segment
    );

    if (childNode.isFile) {
      if (!childNode.file) continue;
      if (!input.istanbulByPath.has(childNode.file.file)) continue;

      const istanbulFileOrNull =
        input.istanbulByPath.get(childNode.file.file) ?? null;
      const fileMetrics = metricsForFile(childNode.file);

      if (shouldHideFileRow(fileMetrics, input.skipFull, input.skipEmpty))
        continue;

      const filePagePath = pagePathForFile(childRelative);
      const detailHtml =
        istanbulFileOrNull === null
          ? renderDetailPageLineOnly({
              title: input.title,
              pagePath: filePagePath,
              breadcrumb: childBreadcrumb,
              currentLabel: childNode.segment,
              metrics: fileMetrics,
              filePath: childNode.file.file,
              lineHits: childNode.file.lineHits,
              resolvedWatermarks: input.resolvedWatermarks,
              datetime: input.datetime,
              backBreadcrumb: input.backBreadcrumb,
              runtime: input.runtime,
            })
          : renderDetailPage({
              title: input.title,
              pagePath: filePagePath,
              breadcrumb: childBreadcrumb,
              currentLabel: childNode.segment,
              metrics: fileMetrics,
              fileCoverage: istanbulFileOrNull,
              resolvedWatermarks: input.resolvedWatermarks,
              datetime: input.datetime,
              backBreadcrumb: input.backBreadcrumb,
              runtime: input.runtime,
            });

      writePage(input.reportsDir, filePagePath, detailHtml);
      continue;
    }

    walkForDetails(
      input,
      childNode,
      childRelative,
      childBreadcrumb,
      childNode.segment
    );
  }
};

export const emitDetailPages = (
  rootNode: TreeNode,
  input: HtmlDetailEmissionInput
): void => {
  walkForDetails(input, rootNode, '', [], input.rootLabel);
};
