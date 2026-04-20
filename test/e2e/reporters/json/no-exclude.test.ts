import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { json } from '../../../__utils__/readers/json.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('json')) {
  const testCase: TestCase = {
    reporter: 'json',
    runtime,
    name: 'no-exclude',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      json.extract(result.fixtureRoot),
      testCase,
      'Writes coverage-final.json without exclude and all:true'
    );
  });
}
