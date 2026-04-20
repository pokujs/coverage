import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { clover } from '../../../__utils__/readers/clover.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('clover')) {
  const testCase: TestCase = {
    reporter: 'clover',
    runtime,
    name: 'exclude-before-remap',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      clover.extract(result.fixtureRoot),
      testCase,
      'Writes clover.xml excluding transpiled files before remapping'
    );
  });
}
