/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/

import type {
  HtmlAnnotatedLine,
  HtmlAnnotationResult,
  HtmlBranchLocation,
  HtmlStructuredLine,
} from '../../../@types/html.js';
import type {
  BranchMapEntry,
  FileCoverage,
  Range,
} from '../../../@types/istanbul.js';
import { fileCoverage } from '../file-coverage.js';
import { insertionText } from './insertion-text.js';

const LT_PLACEHOLDER = '\u0001';
const GT_PLACEHOLDER = '\u0002';
const LT_REGEX = /</g;
const GT_REGEX = />/g;
const AMP_REGEX = /&/g;
const LT_PLACEHOLDER_REGEX = /\u0001/g;
const GT_PLACEHOLDER_REGEX = /\u0002/g;

const titleAttr = (titleText: string): string => ` title="${titleText}" `;

const customEscape = (value: string): string =>
  value
    .replace(AMP_REGEX, '&amp;')
    .replace(LT_REGEX, '&lt;')
    .replace(GT_REGEX, '&gt;')
    .replace(LT_PLACEHOLDER_REGEX, '<')
    .replace(GT_PLACEHOLDER_REGEX, '>');

const annotateLines = (
  coverageEntry: FileCoverage,
  structured: HtmlStructuredLine[]
): void => {
  const hitsPerLine = fileCoverage.lineCoverage(coverageEntry);

  for (const [lineNumber, count] of hitsPerLine) {
    const entry = structured[lineNumber];
    if (!entry) continue;

    entry.covered = count > 0 ? 'yes' : 'no';
    entry.hits = count;
  }
};

const annotateStatements = (
  coverageEntry: FileCoverage,
  structured: HtmlStructuredLine[]
): void => {
  for (const statementName of Object.keys(coverageEntry.statementMap)) {
    const statementMeta = coverageEntry.statementMap[statementName];
    const count = coverageEntry.s[statementName] ?? 0;
    if (count > 0) continue;

    const startLine = statementMeta.start.line;
    const entry = structured[startLine];
    if (!entry) continue;

    const startColumn = statementMeta.start.column;
    let endColumn = statementMeta.end.column + 1;
    if (statementMeta.end.line !== startLine)
      endColumn = entry.text.originalLength();

    const openSpan = `${LT_PLACEHOLDER}span class="cstat-no"${titleAttr('statement not covered')}${GT_PLACEHOLDER}`;
    const closeSpan = `${LT_PLACEHOLDER}/span${GT_PLACEHOLDER}`;

    entry.text.wrap(
      startColumn,
      openSpan,
      startColumn < endColumn ? endColumn : entry.text.originalLength(),
      closeSpan
    );
  }
};

const annotateFunctions = (
  coverageEntry: FileCoverage,
  structured: HtmlStructuredLine[]
): void => {
  for (const functionName of Object.keys(coverageEntry.fnMap)) {
    const functionMeta = coverageEntry.fnMap[functionName];
    const count = coverageEntry.f[functionName] ?? 0;
    if (count > 0) continue;

    const declarationRange: Range = functionMeta.decl || functionMeta.loc;
    const startLine = declarationRange.start.line;
    const entry = structured[startLine];
    if (!entry) continue;

    const startColumn = declarationRange.start.column;
    let endColumn = declarationRange.end.column + 1;
    if (declarationRange.end.line !== startLine)
      endColumn = entry.text.originalLength();

    const openSpan = `${LT_PLACEHOLDER}span class="fstat-no"${titleAttr('function not covered')}${GT_PLACEHOLDER}`;
    const closeSpan = `${LT_PLACEHOLDER}/span${GT_PLACEHOLDER}`;

    entry.text.wrap(
      startColumn,
      openSpan,
      startColumn < endColumn ? endColumn : entry.text.originalLength(),
      closeSpan
    );
  }
};

const isFullLocation = (
  location: HtmlBranchLocation | Range
): location is Range =>
  typeof location.start.line === 'number' &&
  typeof location.start.column === 'number' &&
  typeof location.end.line === 'number' &&
  typeof location.end.column === 'number';

const annotateBranches = (
  coverageEntry: FileCoverage,
  structured: HtmlStructuredLine[]
): void => {
  for (const branchName of Object.keys(coverageEntry.b)) {
    const branchArray = coverageEntry.b[branchName];
    const branchMeta: BranchMapEntry = coverageEntry.branchMap[branchName];
    const sumCount = branchArray.reduce(
      (accumulator, currentCount) => accumulator + currentCount,
      0
    );

    if (!(sumCount > 0 || (sumCount === 0 && branchArray.length === 1)))
      continue;

    const metaLocations: Array<HtmlBranchLocation | Range> =
      branchMeta.locations.slice();

    if (
      branchMeta.type === 'if' &&
      branchArray.length === 2 &&
      metaLocations.length === 1 &&
      branchArray[1] === 0
    )
      metaLocations[1] = {
        start: Object.create(null),
        end: Object.create(null),
      };

    for (
      let armIndex = 0;
      armIndex < branchArray.length && armIndex < metaLocations.length;
      armIndex++
    ) {
      const count = branchArray[armIndex];
      const location = metaLocations[armIndex];
      const fullLocation = isFullLocation(location);
      let startColumn: number | undefined = fullLocation
        ? location.start.column
        : undefined;
      let endColumn: number | undefined = fullLocation
        ? location.end.column + 1
        : undefined;
      let startLine: number | undefined = fullLocation
        ? location.start.line
        : undefined;
      let endLine: number | undefined = fullLocation
        ? location.end.line
        : undefined;

      if (count === 0 && startLine === undefined && branchMeta.type === 'if') {
        const previous = metaLocations[armIndex - 1];
        if (!previous || !isFullLocation(previous)) continue;
        startColumn = previous.start.column;
        endColumn = previous.end.column + 1;
        startLine = previous.start.line;
        endLine = previous.end.line;
      }

      if (
        count !== 0 ||
        startLine === undefined ||
        startColumn === undefined ||
        endColumn === undefined
      )
        continue;

      const entry = structured[startLine];
      if (!entry) continue;

      if (endLine !== startLine) endColumn = entry.text.originalLength();

      if (branchMeta.type === 'if') {
        const marker = armIndex === 0 ? 'I' : 'E';
        const tooltip = `${armIndex === 0 ? 'if' : 'else'} path not taken`;
        entry.text.insertAt(
          startColumn,
          `${LT_PLACEHOLDER}span class="missing-if-branch"${titleAttr(tooltip)}${GT_PLACEHOLDER}${marker}${LT_PLACEHOLDER}/span${GT_PLACEHOLDER}`,
          true,
          false
        );
      } else {
        const openSpan = `${LT_PLACEHOLDER}span class="branch-${armIndex} cbranch-no"${titleAttr('branch not covered')}${GT_PLACEHOLDER}`;
        const closeSpan = `${LT_PLACEHOLDER}/span${GT_PLACEHOLDER}`;
        entry.text.wrap(
          startColumn,
          openSpan,
          startColumn < endColumn ? endColumn : entry.text.originalLength(),
          closeSpan
        );
      }
    }
  }
};

const annotate = (
  coverageEntry: FileCoverage,
  sourceText: string
): HtmlAnnotationResult => {
  const code = sourceText.split(/(?:\r?\n)|\r/);

  const structured: HtmlStructuredLine[] = [
    {
      line: 0,
      covered: 'neutral',
      hits: 0,
      text: insertionText.create('', true),
    },
  ];

  for (let codeIndex = 0; codeIndex < code.length; codeIndex++)
    structured.push({
      line: codeIndex + 1,
      covered: 'neutral',
      hits: 0,
      text: insertionText.create(code[codeIndex], true),
    });

  annotateLines(coverageEntry, structured);
  annotateBranches(coverageEntry, structured);
  annotateFunctions(coverageEntry, structured);
  annotateStatements(coverageEntry, structured);

  structured.shift();

  const lines: HtmlAnnotatedLine[] = structured.map((structuredLine) => ({
    lineNumber: structuredLine.line,
    covered: structuredLine.covered,
    hits: structuredLine.hits > 0 ? `${structuredLine.hits}x` : '&nbsp;',
    annotatedHtml: customEscape(structuredLine.text.toString()) || '&nbsp;',
  }));

  return { lines, maxLines: lines.length };
};

export const htmlAnnotator = { annotate } as const;
