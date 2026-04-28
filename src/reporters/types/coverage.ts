import type {
  FileTypeCoverage,
  FileTypeCoverageBuckets,
  TypeCoverageMap,
  TypeDeclaration,
} from '../../@types/type-coverage.js';

const emptyBuckets = (): FileTypeCoverageBuckets => ({
  total: 0,
  used: 0,
  tested: 0,
  unusedLines: [],
  untestedOnlyLines: [],
  declarations: [],
});

const assemble = (
  declarations: readonly TypeDeclaration[],
  usedSet: ReadonlySet<string>,
  testedSet: ReadonlySet<string>,
  candidateFiles: ReadonlySet<string>,
  testsConfigured: boolean
): TypeCoverageMap => {
  const buckets = new Map<string, FileTypeCoverageBuckets>();
  const map = new Map<string, FileTypeCoverage>();

  for (const fileName of candidateFiles) buckets.set(fileName, emptyBuckets());

  for (const declaration of declarations) {
    const bucket = buckets.get(declaration.fileName) ?? emptyBuckets();
    const isUsed = usedSet.has(declaration.identity);
    const isTested = testedSet.has(declaration.identity);

    bucket.total += 1;

    if (isUsed) bucket.used += 1;
    if (isTested) bucket.tested += 1;

    if (!isUsed) bucket.unusedLines.push(declaration.line);
    else if (testsConfigured && !isTested)
      bucket.untestedOnlyLines.push(declaration.line);

    bucket.declarations.push({
      ...declaration,
      referenced: isUsed,
      tested: isTested,
    });

    buckets.set(declaration.fileName, bucket);
  }

  for (const [fileName, bucket] of buckets) {
    map.set(fileName, {
      absolutePath: fileName,
      total: bucket.total,
      used: bucket.used,
      tested: bucket.tested,
      unusedLines: bucket.unusedLines,
      untestedOnlyLines: bucket.untestedOnlyLines,
      declarations: bucket.declarations,
    });
  }

  return map;
};

export const typesCoverage = { assemble } as const;
