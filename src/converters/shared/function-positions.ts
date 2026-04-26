import { astCache } from './ast-cache.js';
import { astWalk } from './ast-walk.js';

const collect = (source: string): Set<string> => {
  const positions = new Set<string>();

  const program = astCache.parse(source);
  if (program === null) return positions;

  astWalk.forEachNode(program, (node) => {
    if (!astWalk.isFunctionNode(node)) return;
    if (node.loc === null || node.loc === undefined) return;

    positions.add(`${node.loc.start.line}:${node.loc.start.column}`);
  });

  return positions;
};

export const functionPositions = { collect } as const;
