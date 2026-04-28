import type {
  IncomingEdge,
  ParsedFileResult,
  ReferenceGraph,
  TypeDeclaration,
  TypeImportBinding,
} from '../../@types/type-coverage.js';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const RESOLUTION_EXTENSIONS: readonly string[] = [
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
  '.d.ts',
];

const stripExtension = (specifier: string): string => {
  for (const extension of ['.js', '.jsx', '.cjs', '.mjs']) {
    if (specifier.endsWith(extension))
      return specifier.slice(0, specifier.length - extension.length);
  }
  return specifier;
};

const resolveRelativeImport = (
  importer: string,
  source: string,
  knownFiles: ReadonlySet<string>
): string | null => {
  if (!source.startsWith('./') && !source.startsWith('../')) return null;

  const importerDirectory = dirname(importer);
  const baseTarget = resolve(importerDirectory, stripExtension(source));

  for (const extension of RESOLUTION_EXTENSIONS) {
    const candidate = `${baseTarget}${extension}`;
    if (knownFiles.has(candidate)) return candidate;
    if (existsSync(candidate)) return candidate;
  }

  return null;
};

const buildLocalNameTable = (
  fileName: string,
  declarations: readonly TypeDeclaration[],
  imports: readonly TypeImportBinding[],
  knownFiles: ReadonlySet<string>,
  declarationsByIdentity: ReadonlyMap<string, TypeDeclaration>
): Map<string, string> => {
  const table = new Map<string, string>();

  for (const declaration of declarations)
    table.set(declaration.name, declaration.identity);

  for (const binding of imports) {
    const resolved = resolveRelativeImport(
      fileName,
      binding.source,
      knownFiles
    );
    if (resolved === null) continue;

    const targetIdentity = `${resolved}::${binding.importedName}`;
    if (!declarationsByIdentity.has(targetIdentity)) continue;

    table.set(binding.localName, targetIdentity);
  }

  return table;
};

const findEnclosingDeclarationIdentity = (
  referenceLine: number,
  fileDeclarations: readonly TypeDeclaration[]
): string | null => {
  let bestMatch: TypeDeclaration | null = null;

  for (const declaration of fileDeclarations) {
    if (referenceLine < declaration.line) continue;
    if (referenceLine > declaration.endLine) continue;

    if (
      bestMatch === null ||
      declaration.endLine - declaration.line <
        bestMatch.endLine - bestMatch.line
    ) {
      bestMatch = declaration;
    }
  }

  return bestMatch === null ? null : bestMatch.identity;
};

const build = (files: readonly ParsedFileResult[]): ReferenceGraph => {
  const declarationsByIdentity = new Map<string, TypeDeclaration>();
  const declarationsByFile = new Map<string, TypeDeclaration[]>();

  for (const file of files) {
    declarationsByFile.set(file.fileName, [...file.declarations]);
    for (const declaration of file.declarations)
      declarationsByIdentity.set(declaration.identity, declaration);
  }

  const knownFiles = new Set(files.map((file) => file.fileName));
  const incomingEdges = new Map<string, IncomingEdge[]>();
  const fileToReferencedTypes = new Map<string, Set<string>>();

  for (const declaration of declarationsByIdentity.values())
    incomingEdges.set(declaration.identity, []);

  for (const file of files) {
    const localTable = buildLocalNameTable(
      file.fileName,
      file.declarations,
      file.imports,
      knownFiles,
      declarationsByIdentity
    );
    const fileDeclarations = declarationsByFile.get(file.fileName) ?? [];

    for (const referenceSite of file.references) {
      const targetIdentity = localTable.get(referenceSite.referencedName);
      if (targetIdentity === undefined) continue;

      const targetDeclaration = declarationsByIdentity.get(targetIdentity);
      if (targetDeclaration === undefined) continue;

      const incoming = incomingEdges.get(targetIdentity);
      if (incoming === undefined) continue;

      const isSelfReference =
        targetDeclaration.fileName === file.fileName &&
        referenceSite.line >= targetDeclaration.line &&
        referenceSite.line <= targetDeclaration.endLine;
      if (isSelfReference) continue;

      const enclosing = findEnclosingDeclarationIdentity(
        referenceSite.line,
        fileDeclarations
      );

      if (enclosing !== null && enclosing !== targetIdentity) {
        incoming.push({
          kind: 'declaration',
          declarationIdentity: enclosing,
          line: referenceSite.line,
        });

        continue;
      }

      incoming.push({
        kind: 'file',
        fileName: file.fileName,
        line: referenceSite.line,
      });

      const fileTargets =
        fileToReferencedTypes.get(file.fileName) ?? new Set<string>();

      fileTargets.add(targetIdentity);
      fileToReferencedTypes.set(file.fileName, fileTargets);
    }
  }

  const fileToReferencedTypesArrays = new Map<string, string[]>();

  for (const [fileName, set] of fileToReferencedTypes)
    fileToReferencedTypesArrays.set(fileName, [...set]);

  return {
    declarationsByIdentity,
    incomingEdges,
    fileToReferencedTypes: fileToReferencedTypesArrays,
  };
};

export const referenceGraph = { build } as const;
