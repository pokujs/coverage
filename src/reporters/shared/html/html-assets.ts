import { join } from 'node:path';
import { moduleDir } from '../../../utils/module-dir.js';

export const HTML_ASSET_FILENAMES: readonly string[] = [
  'base.css',
  'block-navigation.js',
  'sorter.js',
  'prettify.js',
  'prettify.css',
  'favicon.png',
  'sort-arrow-sprite.png',
];

export const htmlAssetsDir = (): string =>
  join(moduleDir.from(import.meta.url), '..', 'resources', 'html');
