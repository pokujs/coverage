import { mkdir, rm, writeFile } from 'node:fs/promises';
import { generateDtsBundle } from 'dts-bundle-generator';
import * as esbuild from 'esbuild';
import packageJson from '../package.json' with { type: 'json' };

const external = [
  ...Object.keys(packageJson.dependencies ?? Object.create(null)),
  ...Object.keys(packageJson.peerDependencies ?? Object.create(null)),
];

const [dtsBundle] = generateDtsBundle(
  [
    {
      filePath: 'src/index.ts',
      output: { noBanner: true },
      libraries: { importedLibraries: external },
    },
  ],
  { preferredConfigPath: 'tsconfig.json' }
);

await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });

await Promise.all([
  esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'lib/index.js',
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    external,
    logLevel: 'info',
    treeShaking: true,
  }),
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);
