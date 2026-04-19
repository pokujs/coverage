import type { TestCase } from '../../../../src/@types/tests.ts';
import { test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { htmlSpa } from '../../../__utils__/readers/html-spa.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('html-spa')) {
  const testCase: TestCase = {
    reporter: 'html-spa',
    runtime,
    name: 'no-exclude',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      htmlSpa.extract(result.fixtureRoot),
      testCase,
      'Covers every included file when no exclude is set'
    );
  });
}
