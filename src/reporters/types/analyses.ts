import type { ReferenceGraph } from '../../@types/type-coverage.js';

const buildUsesByDeclaration = (
  graph: ReferenceGraph
): ReadonlyMap<string, readonly string[]> => {
  const usesByDeclaration = new Map<string, string[]>();

  for (const [usedIdentity, edges] of graph.incomingEdges) {
    for (const edge of edges) {
      if (edge.kind !== 'declaration') continue;

      const userIdentity = edge.declarationIdentity;
      const usedSet = usesByDeclaration.get(userIdentity) ?? [];

      if (!usedSet.includes(usedIdentity)) {
        usedSet.push(usedIdentity);
        usesByDeclaration.set(userIdentity, usedSet);
      }
    }
  }

  return usesByDeclaration;
};

const computeReachableFromFiles = (
  graph: ReferenceGraph,
  usesByDeclaration: ReadonlyMap<string, readonly string[]>,
  seedFiles: ReadonlySet<string>
): ReadonlySet<string> => {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const [fileName, declarationIdentities] of graph.fileToReferencedTypes) {
    if (!seedFiles.has(fileName)) continue;

    for (const declarationIdentity of declarationIdentities) {
      if (!reachable.has(declarationIdentity)) {
        reachable.add(declarationIdentity);
        queue.push(declarationIdentity);
      }
    }
  }

  while (queue.length > 0) {
    const declarationIdentity = queue.shift();
    if (declarationIdentity === undefined) break;

    const usedIdentities = usesByDeclaration.get(declarationIdentity) ?? [];

    for (const usedIdentity of usedIdentities) {
      if (reachable.has(usedIdentity)) continue;

      reachable.add(usedIdentity);
      queue.push(usedIdentity);
    }
  }

  return reachable;
};

const compute = (
  graph: ReferenceGraph,
  nonTestFiles: ReadonlySet<string>,
  typeTestFiles: ReadonlySet<string>
): { used: ReadonlySet<string>; tested: ReadonlySet<string> } => {
  const usesByDeclaration = buildUsesByDeclaration(graph);

  const used = computeReachableFromFiles(
    graph,
    usesByDeclaration,
    nonTestFiles
  );

  const tested = computeReachableFromFiles(
    graph,
    usesByDeclaration,
    typeTestFiles
  );

  return { used, tested };
};

export const analyses = { compute } as const;
