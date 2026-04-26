import { copyAssetSet } from '../shared/html/copy-assets.js';
import {
  HTML_ASSET_FILENAMES,
  htmlAssetsDir,
} from '../shared/html/html-assets.js';

export const copyAssets = (reportsDir: string): void => {
  copyAssetSet(reportsDir, htmlAssetsDir(), HTML_ASSET_FILENAMES);
};
