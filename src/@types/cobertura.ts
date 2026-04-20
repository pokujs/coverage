export type CoberturaLine = {
  '@_number': string;
  '@_hits': string;
  '@_branch'?: string;
  '@_condition-coverage'?: string;
};

export type CoberturaMethod = {
  '@_name': string;
  '@_hits': string;
  '@_signature'?: string;
  lines?: { line: CoberturaLine | CoberturaLine[] };
};

export type CoberturaClass = {
  '@_name': string;
  '@_filename': string;
  '@_line-rate': string;
  '@_branch-rate': string;
  methods?: { method: CoberturaMethod | CoberturaMethod[] };
  lines?: { line: CoberturaLine | CoberturaLine[] };
};

export type CoberturaCoverage = {
  '@_lines-valid': string;
  '@_lines-covered': string;
  '@_branches-valid': string;
  '@_branches-covered': string;
  packages?: {
    package: {
      classes?: { class: CoberturaClass | CoberturaClass[] };
    };
  };
};

export type CoberturaRoot = {
  coverage: CoberturaCoverage;
};
