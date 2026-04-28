import { mkdir, rm, writeFile } from 'node:fs/promises';
import { generateDtsBundle } from 'dts-bundle-generator';
import * as esbuild from 'esbuild';

const [dtsBundle] = generateDtsBundle(
  [
    {
      filePath: 'src/index.ts',
      output: { noBanner: true },
    },
  ],
  { preferredConfigPath: 'tsconfig.json' }
);

const buildOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: 'node',
  target: 'node16',
  logLevel: 'info',
  treeShaking: true,
  format: 'cjs',
};

await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });
await Promise.all([
  esbuild.build({
    ...buildOptions,
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    minifySyntax: true,
  }),
  esbuild.build({
    ...buildOptions,
    entryPoints: ['src/runtimes/bun/preload.ts'],
    outfile: 'lib/preload-bun.js',
    minify: true,
  }),
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);
