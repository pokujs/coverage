import type { Program } from 'acorn';

export type AstCacheHandler = {
  parse: (source: string) => Program | null;
  reset: () => void;
};
