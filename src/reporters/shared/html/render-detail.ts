import type {
  HtmlAnnotatedLine,
  HtmlDetailPageInput,
} from '../../../@types/html.js';
import { readFileSync } from 'node:fs';
import { htmlAnnotator } from './annotator.js';
import { overallReportClass, renderFooter, renderHeader } from './templates.js';

const buildLineNumbers = (maxLines: number): string => {
  const parts: string[] = [];

  for (let lineNumber = 1; lineNumber <= maxLines; lineNumber++)
    parts.push(
      `<a name='L${lineNumber}'></a><a href='#L${lineNumber}'>${lineNumber}</a>`
    );

  return parts.join('\n');
};

const buildLineCoverage = (lines: readonly HtmlAnnotatedLine[]): string =>
  lines
    .map(
      (annotatedLine) =>
        `<span class="cline-any cline-${annotatedLine.covered}">${annotatedLine.hits}</span>`
    )
    .join('\n');

const readSourceText = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

export const renderDetailPage = (input: HtmlDetailPageInput): string => {
  const sourceText = readSourceText(input.fileCoverage.path);
  const annotation = htmlAnnotator.annotate(input.fileCoverage, sourceText);
  const reportClass = overallReportClass(
    input.resolvedWatermarks,
    input.metrics
  );

  const header = renderHeader({
    title: input.title,
    pagePath: input.pagePath,
    breadcrumb: input.breadcrumb,
    currentLabel: input.currentLabel,
    metrics: input.metrics,
    reportClass,
    datetime: input.datetime,
    backBreadcrumb: input.backBreadcrumb,
    runtime: input.runtime,
  });

  const footer = renderFooter({
    title: input.title,
    pagePath: input.pagePath,
    breadcrumb: input.breadcrumb,
    currentLabel: input.currentLabel,
    metrics: input.metrics,
    reportClass,
    datetime: input.datetime,
    backBreadcrumb: input.backBreadcrumb,
    runtime: input.runtime,
  });

  const lineNumbersHtml = buildLineNumbers(annotation.maxLines);
  const lineCoverageHtml = buildLineCoverage(annotation.lines);
  const annotatedCode = annotation.lines
    .map((annotatedLine) => annotatedLine.annotatedHtml)
    .join('\n');

  const body = [
    '<pre><table class="coverage">',
    '<tr>',
    `<td class="line-count quiet">${lineNumbersHtml}</td>`,
    `<td class="line-coverage quiet">${lineCoverageHtml}</td>`,
    `<td class="text"><pre class="prettyprint lang-js">${annotatedCode}</pre></td>`,
    '</tr>',
    '</table></pre>',
  ].join('\n');

  return `${header}${body}${footer}`;
};
