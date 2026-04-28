import type { TestCase } from '../../../../src/@types/tests.ts';
import { describe, it } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { text } from '../../../__utils__/readers/text.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

describe(async () => {
  for (const runtime of runtimesFor('text')) {
    const testCase: TestCase = {
      reporter: 'text',
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
        text.read(result),
        testCase,
        'Emits text table with ANSI colors when FORCE_COLOR=1'
      );
    });
  }
});
