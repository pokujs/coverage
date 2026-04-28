import type { Node, Program } from 'acorn';
import type {
  ExportNamedDeclarationNode,
  IdentifierNode,
  TSDeclarationKind,
  TSDeclarationNode,
} from '../../@types/acorn-nodes.js';
import type { TypeDeclaration } from '../../@types/type-coverage.js';

const buildIdentity = (fileName: string, typeName: string): string =>
  `${fileName}::${typeName}`;

const classifyKind = (node: Node): TSDeclarationKind | null => {
  if (node.type === 'TSTypeAliasDeclaration') return 'alias';
  if (node.type === 'TSInterfaceDeclaration') return 'interface';
  if (node.type === 'TSDeclareFunction') return 'declareFunction';
  if (node.type === 'TSImportEqualsDeclaration') return 'importEquals';
  return null;
};

const isExportNamed = (node: Node): node is ExportNamedDeclarationNode =>
  node.type === 'ExportNamedDeclaration';

const buildEntry = (
  node: TSDeclarationNode,
  fileName: string,
  kind: TSDeclarationKind,
  exported: boolean
): TypeDeclaration | null => {
  const identifier = node.id as IdentifierNode | undefined;

  if (identifier === undefined) return null;
  if (node.loc === null || node.loc === undefined) return null;

  return {
    identity: buildIdentity(fileName, identifier.name),
    fileName,
    name: identifier.name,
    kind,
    line: node.loc.start.line,
    endLine: node.loc.end.line,
    column: node.loc.start.column + 1,
    exported,
  };
};

const collectStatement = (
  statement: Node,
  fileName: string,
  accumulator: TypeDeclaration[]
): void => {
  if (isExportNamed(statement)) {
    const inner = statement.declaration;
    if (inner === null) return;

    const kind = classifyKind(inner);
    if (kind === null) return;

    const entry = buildEntry(inner as TSDeclarationNode, fileName, kind, true);
    if (entry !== null) accumulator.push(entry);

    return;
  }

  const kind = classifyKind(statement);
  if (kind === null) return;

  const entry = buildEntry(
    statement as TSDeclarationNode,
    fileName,
    kind,
    false
  );

  if (entry !== null) accumulator.push(entry);
};

const collect = (program: Program, fileName: string): TypeDeclaration[] => {
  const declarations: TypeDeclaration[] = [];

  for (const statement of program.body)
    collectStatement(statement, fileName, declarations);

  return declarations;
};

export const typeDeclarations = { collect, buildIdentity } as const;
