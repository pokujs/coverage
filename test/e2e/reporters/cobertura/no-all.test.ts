import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { cobertura } from '../../../__utils__/readers/cobertura.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('cobertura')) {
  const testCase: TestCase = {
    reporter: 'cobertura',
    runtime,
    name: 'no-all',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      cobertura.extract(result.fixtureRoot),
      testCase,
      'Writes cobertura-coverage.xml with include and exclude but all:false'
    );
  });
}
