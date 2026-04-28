import { join } from 'node:path';
import { copyAssetSet } from '../shared/html/copy-assets.js';
import {
  HTML_ASSET_FILENAMES,
  htmlAssetsDir,
} from '../shared/html/html-assets.js';

const SPA_ASSET_FILENAMES: readonly string[] = [
  'bundle.js',
  'spa.css',
  'sort-arrow-sprite.png',
];

const spaAssetsDir = (): string =>
  join(__dirname, '..', 'resources', 'html-spa');

export const copyAssets = (reportsDir: string): void => {
  copyAssetSet(reportsDir, htmlAssetsDir(), HTML_ASSET_FILENAMES);
  copyAssetSet(reportsDir, spaAssetsDir(), SPA_ASSET_FILENAMES);
};
