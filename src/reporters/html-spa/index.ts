import type { HtmlSpaMetricName } from '../../@types/html.js';
import type { HtmlSpaHandler, Reporter } from '../../@types/reporters.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDatetime } from '../../utils/datetime.js';
import { emitDetailPages } from '../shared/html/emit-details.js';
import { projectCoverageMap } from '../shared/html/project-coverage-map.js';
import { buildTree } from '../shared/tree.js';
import { buildHtmlSpaNode } from './build-data.js';
import { copyAssets } from './copy-assets.js';
import { renderShell } from './render-shell.js';

const METRICS_TO_SHOW: readonly HtmlSpaMetricName[] = [
  'lines',
  'branches',
  'functions',
];

const report: Reporter = (context) => {
  const coverageMap = context.produceCoverageMap();
  if (coverageMap === null) return;

  const entries = Object.keys(coverageMap);
  if (entries.length === 0) return;

  const { model, byPath } = projectCoverageMap(coverageMap);
  if (model.length === 0) return;

  const tree = buildTree(model, context.cwd);
  if (tree.children.length === 0) return;

  mkdirSync(context.reportsDir, { recursive: true });
  copyAssets(context.reportsDir);

  const title = 'All files';
  const datetime = formatDatetime();
  const skipFull = context.options.skipFull === true;
  const skipEmpty = context.options.skipEmpty === true;

  emitDetailPages(tree, {
    reportsDir: context.reportsDir,
    title,
    rootLabel: 'All files',
    resolvedWatermarks: context.watermarks,
    istanbulByPath: byPath,
    skipFull,
    skipEmpty,
    datetime,
    backBreadcrumb: true,
    runtime: context.runtime,
  });

  const data = buildHtmlSpaNode(tree, {
    resolvedWatermarks: context.watermarks,
    skipFull,
    skipEmpty,
  });

  const shell = renderShell({
    data,
    datetime,
    metricsToShow: METRICS_TO_SHOW,
  });

  writeFileSync(join(context.reportsDir, 'index.html'), shell);
};

export const htmlSpa: HtmlSpaHandler = { report };
