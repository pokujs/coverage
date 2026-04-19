import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { html } from '../../../__utils__/readers/html.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('html')) {
  const testCase: TestCase = {
    reporter: 'html',
    runtime,
    name: 'no-all',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      html.extract(result.fixtureRoot),
      testCase,
      'Covers only files loaded by tests when all is false'
    );
  });
}
