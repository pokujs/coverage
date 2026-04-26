import type { FileAggregation } from './v8.js';

export type V8AggregationResult = {
  aggregations: Map<string, FileAggregation>;
  sources: Map<string, string>;
};
