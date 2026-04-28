export type CheckCoverageMetric =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines'
  | 'typesReferenced'
  | 'typesTested';

export type CheckCoverageThresholds = {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
  perFile?: boolean;
  typesReferenced?: number;
  typesTested?: number;
};

export type CheckCoverageFailure = {
  scope: 'total' | string;
  metric: CheckCoverageMetric;
  threshold: number;
  actual: number | null;
};
