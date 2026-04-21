import { fileURLToPath } from 'node:url';
import { copyAssetSet } from '../shared/html/copy-assets.js';

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
  fileURLToPath(new URL('../resources/html/', import.meta.url));

export const copyAssets = (reportsDir: string): void => {
  copyAssetSet(reportsDir, htmlAssetsDir(), HTML_ASSET_FILENAMES);
};
