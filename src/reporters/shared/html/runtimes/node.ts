import type { HtmlRuntimeHandler } from '../../../../@types/reporters.js';
import { viaV8Istanbul } from './shared.js';

export const node: HtmlRuntimeHandler = viaV8Istanbul;
