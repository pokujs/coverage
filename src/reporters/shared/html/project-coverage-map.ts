import type { HtmlProjectedCoverage } from '../../../@types/html.js';
import type {
  CoverageMap,
  FileCoverage as IstanbulFileCoverage,
} from '../../../@types/istanbul.js';
import type { CoverageModel, FileCoverage } from '../../../@types/tree.js';
import { fileCoverage } from '../file-coverage.js';

export const projectCoverageMap = (
  coverageMap: CoverageMap
): HtmlProjectedCoverage => {
  const model: CoverageModel = [];
  const byPath = new Map<string, IstanbulFileCoverage | null>();

  for (const absolutePath of Object.keys(coverageMap)) {
    const istanbulFile = coverageMap[absolutePath];
    const fileEntry: FileCoverage = {
      file: istanbulFile.path,
      lineHits: fileCoverage.lineCoverage(istanbulFile),
      functions: fileCoverage.functionsMetric(istanbulFile),
      branches: fileCoverage.branchesMetric(istanbulFile),
      uncoveredBranchPositions: [],
      uncoveredFunctionPositions: [],
    };

    model.push(fileEntry);
    byPath.set(istanbulFile.path, istanbulFile);
  }

  return { model, byPath };
};
