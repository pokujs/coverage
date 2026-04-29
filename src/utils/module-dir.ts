import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const from = (metaUrl: string): string => dirname(fileURLToPath(metaUrl));

export const moduleDir = { from } as const;
