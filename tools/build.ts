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

const sharedBuildOptions: esbuild.BuildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  external,
  logLevel: 'info',
  treeShaking: true,
};

await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });
await Promise.all([
  esbuild.build({
    ...sharedBuildOptions,
    format: 'esm',
    outfile: 'lib/index.js',
  }),
  esbuild.build({
    ...sharedBuildOptions,
    format: 'cjs',
    outfile: 'lib/index.cjs',
    banner: {
      js: "const __importMetaUrl = require('node:url').pathToFileURL(__filename).href;",
    },
    define: { 'import.meta.url': '__importMetaUrl' },
  }),
  writeFile('lib/index.d.ts', dtsBundle, 'utf-8'),
]);
