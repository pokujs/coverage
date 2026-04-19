import type { HtmlRuntimeHandler } from '../../../../@types/reporters.js';
import { lcovonly } from '../../../lcovonly/index.js';
import { projectLcovModel } from '../project-lcov-model.js';

export const bun: HtmlRuntimeHandler = {
  project: (context) => {
    const lcovText = lcovonly.runtimes.bun.produce(context);
    if (lcovText.length === 0) return null;

    const coverageModel = lcovonly.parse(lcovText, context.cwd);
    if (coverageModel.length === 0) return null;

    return projectLcovModel(coverageModel);
  },
};
