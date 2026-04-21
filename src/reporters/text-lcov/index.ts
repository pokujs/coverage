/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report } from '../../@types/reporters.js';
import { lcovonly } from '../lcovonly/index.js';

const report: Report = (context) => {
  const output = lcovonly.runtimes[context.runtime].produce(context);
  if (output.length === 0) return;

  console.log(output);
};

export const textLcov = { report } as const;
