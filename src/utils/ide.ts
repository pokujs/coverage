import type { CoverageOptions } from '../@types/coverage.js';
import type { IDE, IDEUrlBuilders, UrlBuilder } from '../@types/ide.js';
import { pathToFileURL } from 'node:url';
import { supportsHyperlinks } from './terminal.js';

const ideUrlBuilders: IDEUrlBuilders = {
  jetbrains: (filePath, lineNumber, columnNumber) =>
    `idea://open?file=${encodeURIComponent(filePath)}&line=${lineNumber}&column=${columnNumber}`,
  cursor: (filePath, lineNumber, columnNumber) =>
    `cursor://file${filePath}:${lineNumber}:${columnNumber}`,
  windsurf: (filePath, lineNumber, columnNumber) =>
    `windsurf://file${filePath}:${lineNumber}:${columnNumber}`,
  'vscode-insiders': (filePath, lineNumber, columnNumber) =>
    `vscode-insiders://file${filePath}:${lineNumber}:${columnNumber}`,
  vscode: (filePath, lineNumber, columnNumber) =>
    `vscode://file${filePath}:${lineNumber}:${columnNumber}`,
};

export const buildFileLineUrl = (
  absolutePath: string,
  lineNumber: number,
  columnNumber: number,
  ideName?: IDE
): string => {
  const fileUrl = pathToFileURL(absolutePath);

  if (ideName !== undefined)
    return ideUrlBuilders[ideName](fileUrl.pathname, lineNumber, columnNumber);
  return `${fileUrl.href}#L${lineNumber}`;
};

export const resolveUrlBuilder = (
  hyperlinksOption: CoverageOptions['hyperlinks']
): UrlBuilder | null => {
  if (hyperlinksOption === false) return null;
  if (!supportsHyperlinks()) return null;

  const ideName =
    typeof hyperlinksOption === 'string' ? hyperlinksOption : undefined;

  return (absolutePath, lineNumber, columnNumber) =>
    buildFileLineUrl(absolutePath, lineNumber, columnNumber, ideName);
};
