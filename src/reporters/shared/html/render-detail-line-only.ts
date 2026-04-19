import type {
  HtmlCovered,
  HtmlLineOnlyDetailPageInput,
} from '../../../@types/html.js';
import { readFileSync } from 'node:fs';
import { htmlEscape } from '../../../utils/html.js';
import { overallReportClass, renderFooter, renderHeader } from './templates.js';

const readSourceText = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const coveredStateFor = (
  lineNumber: number,
  lineHits: ReadonlyMap<number, number>
): HtmlCovered => {
  const hitCount = lineHits.get(lineNumber);

  if (hitCount === undefined) return 'neutral';
  return hitCount > 0 ? 'yes' : 'no';
};

const buildLineNumbers = (totalLines: number): string => {
  const parts: string[] = [];

  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++)
    parts.push(
      `<a name='L${lineNumber}'></a><a href='#L${lineNumber}'>${lineNumber}</a>`
    );

  return parts.join('\n');
};

const buildLineCoverage = (
  totalLines: number,
  lineHits: ReadonlyMap<number, number>
): string => {
  const parts: string[] = [];

  for (let lineNumber = 1; lineNumber <= totalLines; lineNumber++) {
    const coveredState = coveredStateFor(lineNumber, lineHits);
    const hitCount = lineHits.get(lineNumber);
    const hitsLabel =
      hitCount !== undefined && hitCount > 0 ? `${hitCount}x` : '&nbsp;';

    parts.push(
      `<span class="cline-any cline-${coveredState}">${hitsLabel}</span>`
    );
  }

  return parts.join('\n');
};

const buildSourceLines = (sourceText: string): string[] => {
  const splitLines = sourceText.split(/(?:\r?\n)|\r/);

  return splitLines.map((sourceLine) => htmlEscape(sourceLine) || '&nbsp;');
};

export const renderDetailPageLineOnly = (
  input: HtmlLineOnlyDetailPageInput
): string => {
  const sourceText = readSourceText(input.filePath);
  const sourceLines = buildSourceLines(sourceText);
  const totalLines = sourceLines.length;

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

  const lineNumbersHtml = buildLineNumbers(totalLines);
  const lineCoverageHtml = buildLineCoverage(totalLines, input.lineHits);

  const annotatedCode = sourceLines
    .map((escapedSourceLine, lineIndex) => {
      const hitCount = input.lineHits.get(lineIndex + 1);
      if (hitCount === 0)
        return `<span class="cstat-no" title="line not covered">${escapedSourceLine}</span>`;
      return escapedSourceLine;
    })
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
