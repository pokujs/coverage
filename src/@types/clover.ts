export type CloverLine = {
  '@_num': string;
  '@_count': string;
  '@_type': string;
  '@_truecount'?: string;
  '@_falsecount'?: string;
};

export type CloverFileMetrics = {
  '@_statements': string;
  '@_coveredstatements': string;
  '@_conditionals': string;
  '@_coveredconditionals': string;
  '@_methods': string;
  '@_coveredmethods': string;
};

export type CloverFile = {
  '@_name': string;
  '@_path': string;
  metrics: CloverFileMetrics;
  line?: CloverLine | CloverLine[];
};

export type CloverProjectMetrics = CloverFileMetrics & {
  '@_elements': string;
  '@_coveredelements': string;
};

export type CloverProject = {
  metrics: CloverProjectMetrics;
  package: {
    file: CloverFile | CloverFile[];
  };
};

export type CloverRoot = {
  coverage: {
    project: CloverProject;
  };
};
