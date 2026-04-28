import type { TestCase } from '../../../../src/@types/tests.ts';
import { describe, it } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { textLcov } from '../../../__utils__/readers/text-lcov.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

describe(async () => {
  for (const runtime of runtimesFor('text-lcov')) {
    const testCase: TestCase = {
      reporter: 'text-lcov',
      runtime,
      name: 'default',
      extension: 'json',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase);

      snapshot.matchJson(
        await textLcov.extract(result),
        testCase,
        'Emits LCOV output to stdout with default configuration'
      );
    });
  }
});
