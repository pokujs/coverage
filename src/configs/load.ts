import type { CoverageOptions } from '../@types/coverage.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { configNormalize } from './normalize.js';
import { configParse } from './parse.js';

const load = (cwd: string, customPath?: string | false): CoverageOptions => {
  if (customPath === false) return Object.create(null);

  const expectedFiles = customPath
    ? [customPath]
    : [
        '.coveragerc',
        '.coveragerc.json',
        '.coveragerc.jsonc',
        '.coveragerc.toml',
        '.coveragerc.yaml',
        '.coveragerc.yml',
        '.nycrc',
        '.nycrc.json',
        '.nycrc.jsonc',
        '.nycrc.toml',
        '.nycrc.yaml',
        '.nycrc.yml',
        '.c8rc',
        '.c8rc.json',
        '.c8rc.jsonc',
        '.c8rc.toml',
        '.c8rc.yaml',
        '.c8rc.yml',
      ];

  for (const file of expectedFiles) {
    if (configParse.isScript(file)) continue;

    const filePath = join(cwd, file);
    if (!existsSync(filePath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    return configNormalize.normalize(configParse.parse(content, file));
  }

  return Object.create(null);
};

export const configLoad = { load } as const;
