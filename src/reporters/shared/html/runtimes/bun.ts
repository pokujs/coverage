import type { HtmlProjectedCoverage } from '../../../../@types/html.js';
import type { ReporterContext } from '../../../../@types/reporters.js';
import { lcov } from '../../lcov/index.js';
import { projectLcovModel } from '../project-lcov-model.js';

const project = (context: ReporterContext): HtmlProjectedCoverage | null => {
  const lcovText = lcov.runtimes.bun.produce(context);
  if (lcovText.length === 0) return null;

  const coverageModel = lcov.parse(lcovText, context.cwd);
  if (coverageModel.length === 0) return null;

  return projectLcovModel(coverageModel);
};

export const bun = { project } as const;
