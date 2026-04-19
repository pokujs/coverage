import type { FileAggregation } from '../../@types/v8.js';
import { relativize, toPosix } from '../../utils/paths.js';

export const serializeFileRecord = (
  filePath: string,
  aggregation: FileAggregation,
  cwd: string
): string => {
  const record: string[] = [];

  record.push('TN:');
  record.push(`SF:${toPosix(relativize(filePath, cwd))}`);

  const namedFunctions = Array.from(aggregation.functions.values())
    .filter((functionEntry) => functionEntry.name !== '')
    .sort((left, right) => left.line - right.line);

  for (const namedFunction of namedFunctions)
    record.push(`FN:${namedFunction.line},${namedFunction.name}`);

  record.push(`FNF:${namedFunctions.length}`);
  record.push(
    `FNH:${
      namedFunctions.filter((namedFunction) => namedFunction.outerCount > 0)
        .length
    }`
  );

  for (const namedFunction of namedFunctions)
    record.push(`FNDA:${namedFunction.outerCount},${namedFunction.name}`);

  const sortedLines = Array.from(aggregation.lineHits.entries()).sort(
    (left, right) => left[0] - right[0]
  );

  for (const [lineNumber, hits] of sortedLines)
    record.push(`DA:${lineNumber},${hits}`);

  record.push(`LF:${sortedLines.length}`);
  record.push(`LH:${sortedLines.filter(([, hits]) => hits > 0).length}`);

  const branchFunctions = Array.from(aggregation.functions.values())
    .filter(
      (functionEntry) =>
        functionEntry.isBlockCoverage && functionEntry.blocks.length > 0
    )
    .sort((left, right) => left.line - right.line);

  let branchesFound = 0;
  let branchesHit = 0;
  let blockId = 0;

  for (const branchFunction of branchFunctions) {
    const sortedBlocks = [...branchFunction.blocks].sort(
      (left, right) => left.order - right.order
    );

    for (const block of sortedBlocks) {
      for (let armIndex = 0; armIndex < block.arms.length; armIndex++) {
        const arm = block.arms[armIndex];

        record.push(
          `BRDA:${arm.line},${blockId},${armIndex},${arm.takenCount}`
        );
        branchesFound++;
        if (arm.takenCount > 0) branchesHit++;
      }
      blockId++;
    }
  }

  record.push(`BRF:${branchesFound}`);
  record.push(`BRH:${branchesHit}`);
  record.push('end_of_record');

  return record.join('\n');
};

export const serializeLcov = (
  fileAggregations: Map<string, FileAggregation>,
  cwd: string
): string => {
  if (fileAggregations.size === 0) return '';

  const chunks: string[] = [];
  const sortedFilePaths = Array.from(fileAggregations.keys()).sort();

  for (const filePath of sortedFilePaths) {
    const aggregation = fileAggregations.get(filePath);
    if (!aggregation) continue;
    if (aggregation.lineHits.size === 0 && aggregation.functions.size === 0)
      continue;

    chunks.push(serializeFileRecord(filePath, aggregation, cwd));
  }

  return chunks.length === 0 ? '' : chunks.join('\n') + '\n';
};
