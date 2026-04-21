/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report } from '../../@types/reporters.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { converters } from '../../converters/index.js';
import { prepareCoverageMap } from '../shared/file-coverage.js';

const report: Report = (context) => {
  const coverageMap = converters.v8ToIstanbul(
    context.tempDir,
    context.cwd,
    context.preRemapFilter
  );

  prepareCoverageMap(coverageMap, context);

  if (Object.keys(coverageMap).length === 0) return;

  mkdirSync(context.reportsDir, { recursive: true });
  writeFileSync(
    join(context.reportsDir, 'coverage-final.json'),
    JSON.stringify(coverageMap),
    'utf8'
  );
};

export const json = { report } as const;
