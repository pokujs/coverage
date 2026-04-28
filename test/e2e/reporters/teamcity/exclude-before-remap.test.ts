import type { TestCase } from '../../../../src/@types/tests.ts';
import { describe, it } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { teamcity } from '../../../__utils__/readers/teamcity.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

describe(async () => {
  for (const runtime of runtimesFor('teamcity')) {
    const testCase: TestCase = {
      reporter: 'teamcity',
      runtime,
      name: 'exclude-before-remap',
      extension: 'txt',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const result = await fixture.run(testCase);

      snapshot.match(
        teamcity.read(result),
        testCase,
        'Emits TeamCity build statistics excluding transpiled files before remapping'
      );
    });
  }
});
