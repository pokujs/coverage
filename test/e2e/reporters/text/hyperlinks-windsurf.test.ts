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
      name: 'hyperlinks-windsurf',
      extension: 'txt',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase, {
        FORCE_HYPERLINKS: '1',
        NO_HYPERLINKS: undefined,
      });

      snapshot.match(
        text.read(result),
        testCase,
        'Emits OSC 8 hyperlinks with windsurf:// scheme'
      );
    });
  }
});
