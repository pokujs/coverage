import type { TSDeclarationKind } from './acorn-nodes.js';

export type { TSDeclarationKind };

export type TypeDeclaration = {
  identity: string;
  fileName: string;
  name: string;
  kind: TSDeclarationKind;
  line: number;
  endLine: number;
  column: number;
  exported: boolean;
};

export type TypeImportBinding = {
  fileName: string;
  localName: string;
  importedName: string;
  source: string;
};

export type TypeReferenceSite = {
  fileName: string;
  line: number;
  referencedName: string;
};

export type TypesOptions = {
  /**
   * Globs identifying type-test files (e.g. `tsd` `.test-d.ts`). Used by the
   * `tested` axis to mark types reachable from a type-test file. When
   * omitted or empty, the `% Types Tested` column is not applicable and
   * renders as a gray dash.
   *
   * @default undefined
   */
  tests?: readonly string[];
};

export type TypeStatusKey = 'used' | 'tested';

export type TypeCoverageDeclaration = TypeDeclaration & {
  referenced: boolean;
  tested: boolean;
};

export type FileTypeCoverage = {
  absolutePath: string;
  total: number;
  used: number;
  tested: number;
  unusedLines: readonly number[];
  untestedOnlyLines: readonly number[];
  declarations: readonly TypeCoverageDeclaration[];
};

export type TypeCoverageMap = ReadonlyMap<string, FileTypeCoverage>;

export type TypeCoverageReport = {
  files: TypeCoverageMap;
  testsConfigured: boolean;
};

export type ParsedFileResult = {
  fileName: string;
  declarations: readonly TypeDeclaration[];
  imports: readonly TypeImportBinding[];
  references: readonly TypeReferenceSite[];
};

export type DiscoveryResult = {
  files: readonly ParsedFileResult[];
  declarations: readonly TypeDeclaration[];
};

export type IncomingEdge =
  | { kind: 'declaration'; declarationIdentity: string; line: number }
  | { kind: 'file'; fileName: string; line: number };

export type ReferenceGraph = {
  declarationsByIdentity: ReadonlyMap<string, TypeDeclaration>;
  incomingEdges: ReadonlyMap<string, readonly IncomingEdge[]>;
  fileToReferencedTypes: ReadonlyMap<string, readonly string[]>;
};

export type FileSets = {
  nonTestFiles: ReadonlySet<string>;
  typeTestFiles: ReadonlySet<string>;
};

export type FileSetOptions = {
  cwd: string;
  typeTestGlobs: readonly string[];
};

export type FileTypeCoverageBuckets = {
  total: number;
  used: number;
  tested: number;
  unusedLines: number[];
  untestedOnlyLines: number[];
  declarations: TypeCoverageDeclaration[];
};

export type TypeReferenceVisitor = (
  referencedName: string,
  line: number
) => void;
