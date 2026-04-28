import type { TypeCoverageReport } from '../../@types/type-coverage.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const buildPayload = (report: TypeCoverageReport, cwd: string): string => {
  const files = [...report.files.values()].map((file) => ({
    path: relative(cwd, file.absolutePath),
    total: file.total,
    referenced: file.used,
    tested: report.testsConfigured ? file.tested : null,
    declarations: file.declarations.map((declaration) => ({
      identity: declaration.identity,
      name: declaration.name,
      kind: declaration.kind,
      line: declaration.line,
      endLine: declaration.endLine,
      column: declaration.column,
      exported: declaration.exported,
      referenced: declaration.referenced,
      tested: report.testsConfigured ? declaration.tested : null,
    })),
  }));

  return JSON.stringify({ files }, null, 2);
};

const write = (
  report: TypeCoverageReport,
  cwd: string,
  reportsDir: string
): void => {
  if (report.files.size === 0) return;

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(join(reportsDir, 'types.json'), buildPayload(report, cwd));
};

export const typesJson = { write } as const;
