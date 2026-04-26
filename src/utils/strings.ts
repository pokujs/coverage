const slug = (input: string): string =>
  input.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

const escapeRegex = (input: string): string =>
  input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const strings = { slug, escapeRegex } as const;
