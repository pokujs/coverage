export type CheckCoverageMetric =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines';

export type CheckCoverageFailure = {
  scope: 'total' | string;
  metric: CheckCoverageMetric;
  threshold: number;
  actual: number | null;
};
