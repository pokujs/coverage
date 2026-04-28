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
      name: 'colors',
      extension: 'txt',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase, {
        FORCE_COLOR: '1',
        NO_COLOR: undefined,
      });

      snapshot.match(
        textSummary.read(result),
        testCase,
        'Emits coverage summary with ANSI colors when FORCE_COLOR=1'
      );
    });
  }
});
