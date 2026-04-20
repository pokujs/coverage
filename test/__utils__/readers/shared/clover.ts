import type { CloverFile, CloverRoot } from '../../../../src/@types/clover.js';
import type {
  BranchHit,
  CoverageSnapshot,
  FileSnapshot,
  FunctionHit,
  MetricsBundle,
} from '../../../../src/@types/tests.ts';
import { coverageSnapshot } from './snapshot.ts';
import { xmlShared } from './xml.ts';

const buildFileSnapshot = (file: CloverFile): FileSnapshot => {
  const lineEntries = xmlShared.toArray(file.line);
  const lineHits: Record<number, number> = {};
  const coveredLines: number[] = [];
  const uncoveredLines: number[] = [];
  const branchHits: BranchHit[] = [];
  const functionHits: FunctionHit[] = [];

  for (const line of lineEntries) {
    const lineNumber = Number(line['@_num']);
    const count = Number(line['@_count']);

    lineHits[lineNumber] = count;

    if (count > 0) coveredLines.push(lineNumber);
    else uncoveredLines.push(lineNumber);

    if (line['@_type'] === 'cond') {
      const trueCount = Number(line['@_truecount'] ?? '0');
      const falseCount = Number(line['@_falsecount'] ?? '0');

      branchHits.push({
        line: lineNumber,
        branch: 0,
        hit: trueCount,
        taken: trueCount,
      });

      branchHits.push({
        line: lineNumber,
        branch: 1,
        hit: falseCount,
        taken: falseCount,
      });
    } else if (line['@_type'] === 'method') {
      functionHits.push({
        name: '',
        line: lineNumber,
        hit: count,
      });
    }
  }

  const statementsTotal = Number(file.metrics['@_statements']);
  const statementsCovered = Number(file.metrics['@_coveredstatements']);
  const conditionalsTotal = Number(file.metrics['@_conditionals']);
  const conditionalsCovered = Number(file.metrics['@_coveredconditionals']);
  const methodsTotal = Number(file.metrics['@_methods']);
  const methodsCovered = Number(file.metrics['@_coveredmethods']);
  const metrics: MetricsBundle = {
    statements: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
    branches: coverageSnapshot.buildMetricDetail(
      conditionalsTotal,
      conditionalsCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(methodsTotal, methodsCovered),
    lines: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
  };

  return {
    ...metrics,
    uncoveredLines: coverageSnapshot.compressRanges(uncoveredLines),
    coveredLines: coverageSnapshot.compressRanges(coveredLines),
    lineHits,
    branchHits,
    functionHits,
  };
};

const parse = (content: string): CoverageSnapshot => {
  const parsed = xmlShared.parse(content) as CloverRoot;
  const project = parsed.coverage.project;
  const projectMetrics = project.metrics;
  const statementsTotal = Number(projectMetrics['@_statements']);
  const statementsCovered = Number(projectMetrics['@_coveredstatements']);
  const conditionalsTotal = Number(projectMetrics['@_conditionals']);
  const conditionalsCovered = Number(projectMetrics['@_coveredconditionals']);
  const methodsTotal = Number(projectMetrics['@_methods']);
  const methodsCovered = Number(projectMetrics['@_coveredmethods']);
  const fileEntries = xmlShared.toArray(project.package.file);
  const files: Record<string, FileSnapshot> = {};
  const totals: MetricsBundle = {
    statements: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
    branches: coverageSnapshot.buildMetricDetail(
      conditionalsTotal,
      conditionalsCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(methodsTotal, methodsCovered),
    lines: coverageSnapshot.buildMetricDetail(
      statementsTotal,
      statementsCovered
    ),
  };

  for (const file of fileEntries) {
    files[file['@_path']] = buildFileSnapshot(file);
  }

  return {
    reporter: 'clover',
    totals,
    files: coverageSnapshot.sortFileEntries(files),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const cloverShared = {
  parse,
  formatParsed,
} as const;
