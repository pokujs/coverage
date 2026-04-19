import type { HtmlProjectedCoverage } from '../../../@types/html.js';
import type {
  CoverageMap,
  FileCoverage as IstanbulFileCoverage,
} from '../../../@types/istanbul.js';
import type { CoverageModel, FileCoverage } from '../../../@types/tree.js';
import {
  fileBranchesMetric,
  fileFunctionsMetric,
  lineCoverage,
} from '../file-coverage.js';

export const projectCoverageMap = (
  coverageMap: CoverageMap
): HtmlProjectedCoverage => {
  const model: CoverageModel = [];
  const byPath = new Map<string, IstanbulFileCoverage | null>();

  for (const absolutePath of Object.keys(coverageMap)) {
    const istanbulFile = coverageMap[absolutePath];
    const fileCoverage: FileCoverage = {
      file: istanbulFile.path,
      lineHits: lineCoverage(istanbulFile),
      functions: fileFunctionsMetric(istanbulFile),
      branches: fileBranchesMetric(istanbulFile),
      uncoveredBranchPositions: [],
    };

    model.push(fileCoverage);
    byPath.set(istanbulFile.path, istanbulFile);
  }

  return { model, byPath };
};
