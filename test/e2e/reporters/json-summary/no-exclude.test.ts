import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { jsonSummary } from '../../../__utils__/readers/json-summary.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('json-summary')) {
  const testCase: TestCase = {
    reporter: 'json-summary',
    runtime,
    name: 'no-exclude',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      jsonSummary.extract(result.fixtureRoot),
      testCase,
      'Writes coverage-summary.json without exclude and all:true'
    );
  });
}
