import type { TestCase } from '../../../../src/@types/tests.ts';
import { describe, it } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { textSummary } from '../../../__utils__/readers/text-summary.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

describe(async () => {
  for (const runtime of runtimesFor('text-summary')) {
    const testCase: TestCase = {
      reporter: 'text-summary',
      runtime,
      name: 'exclude-after-remap',
      extension: 'txt',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase);

      snapshot.match(
        textSummary.read(result),
        testCase,
        'Emits coverage summary excluding transpiled files after remapping'
      );
    });
  }
});
