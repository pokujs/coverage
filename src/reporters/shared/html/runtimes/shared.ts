import type { HtmlRuntimeHandler } from '../../../../@types/reporters.js';
import { projectCoverageMap } from '../project-coverage-map.js';

export const viaV8Istanbul: HtmlRuntimeHandler = {
  project: (context) => {
    const coverageMap = context.produceCoverageMap();
    if (coverageMap === null) return null;

    return projectCoverageMap(coverageMap);
  },
};
