import type { Node, Program } from 'acorn';
import type {
  ImportDeclarationNode,
  ImportSpecifierNode,
} from '../../@types/acorn-nodes.js';
import type { TypeImportBinding } from '../../@types/type-coverage.js';

const isImportDeclaration = (node: Node): node is ImportDeclarationNode =>
  node.type === 'ImportDeclaration';

const isImportSpecifier = (node: Node): node is ImportSpecifierNode =>
  node.type === 'ImportSpecifier';

const collectFromDeclaration = (
  declaration: ImportDeclarationNode,
  fileName: string,
  accumulator: TypeImportBinding[]
): void => {
  const moduleSource =
    typeof declaration.source.value === 'string'
      ? declaration.source.value
      : null;
  if (moduleSource === null) return;

  const isTypeOnlyImport = declaration.importKind === 'type';

  for (const specifier of declaration.specifiers) {
    if (!isImportSpecifier(specifier)) continue;

    const isInlineTypeSpecifier = specifier.importKind === 'type';
    if (!isTypeOnlyImport && !isInlineTypeSpecifier) continue;

    accumulator.push({
      fileName,
      localName: specifier.local.name,
      importedName: specifier.imported.name,
      source: moduleSource,
    });
  }
};

const collect = (program: Program, fileName: string): TypeImportBinding[] => {
  const imports: TypeImportBinding[] = [];

  for (const statement of program.body) {
    if (!isImportDeclaration(statement)) continue;

    collectFromDeclaration(statement, fileName, imports);
  }

  return imports;
};

export const typeImports = { collect } as const;
