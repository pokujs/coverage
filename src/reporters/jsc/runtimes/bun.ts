import type { ReporterContext } from '../../../@types/reporters.js';
import { copyJscBlocksTo } from '../copy.js';

const run = (context: ReporterContext): void => {
  copyJscBlocksTo(context.tempDir, context.reportsDir);
};

export const bun = { run } as const;
