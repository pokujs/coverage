import type { HtmlProjectedCoverage } from '../../../@types/html.js';
import type { FileCoverage as IstanbulFileCoverage } from '../../../@types/istanbul.js';
import type { CoverageModel } from '../../../@types/tree.js';

export const projectLcovModel = (
  coverageModel: CoverageModel
): HtmlProjectedCoverage => {
  const byPath = new Map<string, IstanbulFileCoverage | null>();

  for (const fileCoverage of coverageModel) byPath.set(fileCoverage.file, null);

  return { model: coverageModel, byPath };
};
