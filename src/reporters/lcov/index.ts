/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report } from '../../@types/reporters.js';
import { join } from 'node:path';
import { html } from '../html/index.js';
import { lcovonly } from '../lcovonly/index.js';

const report: Report = (context) => {
  lcovonly.report(context);

  html.report({
    ...context,
    reportsDir: join(context.reportsDir, 'lcov-report'),
  });
};

export const lcov = { report } as const;
