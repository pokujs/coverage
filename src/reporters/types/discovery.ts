import type {
  DiscoveryResult,
  ParsedFileResult,
  TypeDeclaration,
  TypeReferenceSite,
} from '../../@types/type-coverage.js';
import { readFileSync } from 'node:fs';
import { astCache } from '../../converters/shared/ast-cache.js';
import { typeDeclarations } from '../../converters/shared/type-declarations.js';
import { typeImports } from '../../converters/shared/type-imports.js';
import { typeReferences } from '../../converters/shared/type-references.js';

const readSource = (absolutePath: string): string | null => {
  try {
    return readFileSync(absolutePath, 'utf8');
  } catch {
    return null;
  }
};

const parseFile = (absolutePath: string): ParsedFileResult | null => {
  const source = readSource(absolutePath);
  if (source === null) return null;

  const program = astCache.parse(source);
  if (program === null) return null;

  const references: TypeReferenceSite[] = [];
  const declarations = typeDeclarations.collect(program, absolutePath);
  const imports = typeImports.collect(program, absolutePath);

  typeReferences.forEach(program, (referencedName, line) => {
    references.push({ fileName: absolutePath, referencedName, line });
  });

  return { fileName: absolutePath, declarations, imports, references };
};

const run = (candidateFiles: ReadonlySet<string>): DiscoveryResult => {
  const files: ParsedFileResult[] = [];
  const declarations: TypeDeclaration[] = [];

  for (const absolutePath of candidateFiles) {
    const parsed = parseFile(absolutePath);
    if (parsed === null) continue;

    files.push(parsed);

    for (const declaration of parsed.declarations)
      declarations.push(declaration);
  }

  return { files, declarations };
};

export const typesDiscovery = { run } as const;
