import { join } from 'node:path';

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
  join(__dirname, '..', 'resources', 'html');
