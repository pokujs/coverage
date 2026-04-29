import type { BuildOptions, Plugin } from 'esbuild';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { generateDtsBundle } from 'dts-bundle-generator';
import { build } from 'esbuild';

const externalizeCore = (targetSpecifier: string): Plugin => ({
  name: 'externalize-core',
  setup(buildInstance) {
    buildInstance.onResolve({ filter: /(^|\/)core\.js$/ }, () => ({
      path: targetSpecifier,
      external: true,
    }));
  },
});

const esmToCjs: Pick<BuildOptions, 'banner' | 'define'> = {
  banner: {
    js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
  },
  define: { 'import.meta.url': '__importMetaUrl' },
};

const [dtsBundle] = generateDtsBundle(
  [{ filePath: 'src/index.ts', output: { noBanner: true } }],
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
  // Index
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    plugins: [externalizeCore('./core.js')],
  }),
  build({
    ...buildOptions,
    ...esmToCjs,
    format: 'cjs',
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.cjs',
    plugins: [externalizeCore('./core.cjs')],
  }),

  // Core
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/core.ts'],
    outfile: 'lib/core.js',
  }),
  build({
    ...buildOptions,
    ...esmToCjs,
    format: 'cjs',
    entryPoints: ['src/core.ts'],
    outfile: 'lib/core.cjs',
  }),

  // Preload
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/runtimes/bun/preload.ts'],
    outfile: 'lib/preload-bun.js',
    minify: true,
  }),

  // CLI
  build({
    ...buildOptions,
    format: 'esm',
    entryPoints: ['src/bin/cli.ts'],
    outfile: 'lib/bin/cli.js',
    banner: { js: '#!/usr/bin/env node' },
    external: ['../core.js'],
  }),

  // Declarations
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);

await chmod('lib/bin/cli.js', 0o755);
