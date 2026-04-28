import type { Report } from '../../@types/reporters.js';
import { allFiles } from '../../all-files.js';
import { ide } from '../../utils/ide.js';
import { analyses } from './analyses.js';
import { typesCoverage } from './coverage.js';
import { typesDiscovery } from './discovery.js';
import { fileSets } from './file-sets.js';
import { typesJson } from './json.js';
import { referenceGraph } from './reference-graph.js';
import { typesTable } from './table.js';

const report: Report = (context) => {
  const candidateFiles = allFiles.discover(context);
  if (candidateFiles.size === 0) return;

  const discovery = typesDiscovery.run(candidateFiles);
  if (discovery.declarations.length === 0) return;

  const graph = referenceGraph.build(discovery.files);

  const typeTestGlobs = fileSets.resolveTypeTestGlobs(
    context.options.types?.tests
  );

  const testsConfigured = typeTestGlobs.length > 0;

  const { nonTestFiles, typeTestFiles } = fileSets.derive(candidateFiles, {
    cwd: context.cwd,
    typeTestGlobs,
  });

  const { used, tested } = analyses.compute(graph, nonTestFiles, typeTestFiles);

  const coverageMap = typesCoverage.assemble(
    discovery.declarations,
    used,
    tested,
    candidateFiles,
    testsConfigured
  );

  const report = { files: coverageMap, testsConfigured };

  context.typeCoverageReport = report;

  const urlBuilder = ide.resolveUrlBuilder(context.options.hyperlinks);

  const output = typesTable.render(
    report,
    context.cwd,
    context.watermarks,
    urlBuilder
  );
  if (output.length === 0) return;

  console.log(output);

  typesJson.write(report, context.cwd, context.reportsDir);
};

export const types = { report } as const;
