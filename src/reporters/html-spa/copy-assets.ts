import { fileURLToPath } from 'node:url';
import { HTML_ASSET_FILENAMES, htmlAssetsDir } from '../html/copy-assets.js';
import { copyAssetSet } from '../shared/html/copy-assets.js';

const SPA_ASSET_FILENAMES: readonly string[] = [
  'bundle.js',
  'spa.css',
  'sort-arrow-sprite.png',
];

const spaAssetsDir = (): string =>
  fileURLToPath(new URL('../resources/html-spa/', import.meta.url));

export const copyAssets = (reportsDir: string): void => {
  copyAssetSet(reportsDir, htmlAssetsDir(), HTML_ASSET_FILENAMES);
  copyAssetSet(reportsDir, spaAssetsDir(), SPA_ASSET_FILENAMES);
};
