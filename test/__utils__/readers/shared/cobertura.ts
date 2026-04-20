import type {
  CoberturaClass,
  CoberturaRoot,
} from '../../../../src/@types/cobertura.js';
import type {
  BranchHit,
  CoverageSnapshot,
  FileSnapshot,
  FunctionHit,
  MetricsBundle,
} from '../../../../src/@types/tests.ts';
import { coverageSnapshot } from './snapshot.ts';
import { xmlShared } from './xml.ts';

const parseConditionCoverage = (
  value: string | undefined
): { total: number; covered: number } => {
  if (!value) return { total: 0, covered: 0 };
  const match = /\((\d+)\/(\d+)\)/.exec(value);
  if (!match) return { total: 0, covered: 0 };
  return { covered: Number(match[1]), total: Number(match[2]) };
};

const buildFileSnapshot = (classNode: CoberturaClass): FileSnapshot => {
  const lineEntries = xmlShared.toArray(classNode.lines?.line);

  const lineHits: Record<number, number> = Object.create(null);
  const coveredLines: number[] = [];
  const uncoveredLines: number[] = [];
  let branchesTotal = 0;
  let branchesCovered = 0;
  const branchHits: BranchHit[] = [];

  for (const line of lineEntries) {
    const lineNumber = Number(line['@_number']);
    const hits = Number(line['@_hits']);
    lineHits[lineNumber] = hits;
    if (hits > 0) coveredLines.push(lineNumber);
    else uncoveredLines.push(lineNumber);

    if (line['@_branch'] === 'true') {
      const { total, covered } = parseConditionCoverage(
        line['@_condition-coverage']
      );
      branchesTotal += total;
      branchesCovered += covered;
      branchHits.push({
        line: lineNumber,
        hit: covered,
        taken: covered,
      });
    }
  }

  const methodEntries = xmlShared.toArray(classNode.methods?.method);
  const functionHits: FunctionHit[] = methodEntries.map((method) => {
    const methodLine = xmlShared.toArray(method.lines?.line)[0];
    return {
      name: method['@_name'],
      line: methodLine ? Number(methodLine['@_number']) : undefined,
      hit: Number(method['@_hits']),
    };
  });
  const functionsTotal = functionHits.length;
  const functionsCovered = functionHits.filter(
    (entry) => (entry.hit ?? 0) > 0
  ).length;

  const linesTotal = lineEntries.length;
  const linesCovered = coveredLines.length;

  const metrics: MetricsBundle = {
    lines: coverageSnapshot.buildMetricDetail(linesTotal, linesCovered),
    branches: coverageSnapshot.buildMetricDetail(
      branchesTotal,
      branchesCovered
    ),
    functions: coverageSnapshot.buildMetricDetail(
      functionsTotal,
      functionsCovered
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
  const parsed = xmlShared.parse(content) as CoberturaRoot;
  const coverage = parsed.coverage;
  const classes = xmlShared.toArray(coverage.packages?.package.classes?.class);
  const files: Record<string, FileSnapshot> = Object.create(null);
  const totals: MetricsBundle = {
    lines: coverageSnapshot.buildMetricDetail(
      Number(coverage['@_lines-valid']),
      Number(coverage['@_lines-covered'])
    ),
    branches: coverageSnapshot.buildMetricDetail(
      Number(coverage['@_branches-valid']),
      Number(coverage['@_branches-covered'])
    ),
  };

  for (const classNode of classes) {
    files[classNode['@_filename']] = buildFileSnapshot(classNode);
  }

  return {
    reporter: 'cobertura',
    totals,
    files: coverageSnapshot.sortFileEntries(files),
  };
};

const formatParsed = coverageSnapshot.formatSnapshot;

export const coberturaShared = {
  parse,
  formatParsed,
} as const;
