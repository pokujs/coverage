import type { FileSetOptions, FileSets } from '../../@types/type-coverage.js';
import { globs } from '../../utils/globs.js';
import { paths } from '../../utils/paths.js';

const resolveTypeTestGlobs = (
  configured: readonly string[] | undefined
): readonly string[] => {
  if (configured === undefined) return [];
  return configured;
};

const derive = (
  candidateFiles: ReadonlySet<string>,
  options: FileSetOptions
): FileSets => {
  const compiledTypeTests = globs.compile(options.typeTestGlobs);
  const nonTestFiles = new Set<string>();
  const typeTestFiles = new Set<string>();

  for (const absolutePath of candidateFiles) {
    const relativePath = paths.toPosix(
      paths.relativize(absolutePath, options.cwd)
    );

    if (globs.matchesAny(compiledTypeTests, relativePath))
      typeTestFiles.add(absolutePath);
    else nonTestFiles.add(absolutePath);
  }

  return { nonTestFiles, typeTestFiles };
};

export const fileSets = {
  derive,
  resolveTypeTestGlobs,
} as const;
