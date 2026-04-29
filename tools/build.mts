import type { BuildOptions } from 'esbuild';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { generateDtsBundle } from 'dts-bundle-generator';
import { build } from 'esbuild';

const [dtsBundle] = generateDtsBundle(
  [
    {
      filePath: 'src/index.ts',
      output: { noBanner: true },
    },
  ],
  { preferredConfigPath: 'tsconfig.json' }
);

const buildOptions: BuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  logLevel: 'info',
  treeShaking: true,
  minifySyntax: true,
  external: [
    'acorn',
    'jsonc.min',
    'poku',
    'poku/plugin',
    'toml.min',
    'yaml.min',
  ],
};

await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });
await Promise.all([
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
  }),
  build({
    ...buildOptions,
    format: 'cjs',
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.cjs',
    banner: {
      js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  }),
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/runtimes/bun/preload.ts'],
    outfile: 'lib/preload-bun.js',
    minify: true,
  }),
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/bin/cli.ts'],
    outfile: 'lib/bin/cli.js',
    banner: { js: '#!/usr/bin/env node' },
    external: ['../index.js'],
  }),
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);

await chmod('lib/bin/cli.js', 0o755);
