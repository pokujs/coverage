import type { TestCase } from '../../../../src/@types/tests.ts';
import { describe, it } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { html } from '../../../__utils__/readers/html.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

describe(async () => {
  for (const runtime of runtimesFor('html')) {
    const testCase: TestCase = {
      reporter: 'html',
      runtime,
      name: 'exclude-after-remap',
      extension: 'json',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase);

      snapshot.matchJson(
        await html.extract(result.fixtureRoot),
        testCase,
        'Applies post-remap filter on original source path'
      );
    });
  }
});
