import type { TestCase } from '../../../../src/@types/tests.ts';
import { existsSync } from 'node:fs';
import { strict, test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { v8 } from '../../../__utils__/readers/v8.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimesFor('v8')) {
  const testCase: TestCase = {
    reporter: 'v8',
    runtime,
    name: 'default',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);
    const v8Dir = `${result.fixtureRoot}/coverage/v8`;

    strict.equal(existsSync(v8Dir), true, 'coverage/v8/ must be created');

    snapshot.matchJson(
      v8.extract(result.fixtureRoot),
      testCase,
      'Emits one normalized V8 coverage JSON per user script'
    );
  });
}
