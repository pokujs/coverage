/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

import type { Report } from '../../@types/reporters.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildFromCoverageMap } from './from-coverage-map.js';
import { buildFromLcov } from './from-lcov.js';

const XML_PROLOGUE = '<?xml version="1.0" encoding="UTF-8"?>\n';

const report: Report = (context) => {
  const xmlBody =
    context.runtime === 'bun'
      ? buildFromLcov(context)
      : buildFromCoverageMap(context);

  if (xmlBody === undefined) return;

  mkdirSync(context.reportsDir, { recursive: true });
  writeFileSync(
    join(context.reportsDir, 'clover.xml'),
    XML_PROLOGUE + xmlBody + '\n',
    'utf8'
  );
};

export const clover = { report } as const;
