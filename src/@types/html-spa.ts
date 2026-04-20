import type { SnapshotMetric } from './tests.js';

export type HtmlSpaRawMetric = {
  total: number;
  covered: number;
};

export type HtmlSpaRawNode = {
  file: string;
  isEmpty: boolean;
  metrics: Record<SnapshotMetric, HtmlSpaRawMetric>;
  children?: readonly HtmlSpaRawNode[];
};
