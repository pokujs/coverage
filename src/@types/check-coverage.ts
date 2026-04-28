export type CoverageMetric =
  | 'statements'
  | 'branches'
  | 'functions'
  | 'lines'
  | 'typesReferenced'
  | 'typesTested';

export type CoverageThresholds = {
  statements?: number;
  branches?: number;
  functions?: number;
  lines?: number;
  perFile?: boolean;
  typesReferenced?: number;
  typesTested?: number;
};

export type CoverageFailure = {
  scope: 'total' | string;
  metric: CoverageMetric;
  threshold: number;
  actual: number | null;
};
