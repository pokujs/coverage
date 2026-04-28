import type { TestCase } from '../../../../src/@types/tests.ts';
import { existsSync, rmSync } from 'node:fs';
import { describe, it, strict } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { runtimesFor } from '../../../__utils__/runtime.ts';

describe(async () => {
  for (const runtime of runtimesFor('none')) {
    const testCase: TestCase = {
      reporter: 'none',
      runtime,
      name: 'default',
    };

    await it(`${runtime}: ${testCase.name}`, async () => {
      const reportsDir = `test/__fixtures__/e2e/none/${runtime}/default/coverage`;
      rmSync(reportsDir, { recursive: true, force: true });

      const result = await fixture.run(testCase);

      strict.equal(result.exitCode, 0);
      strict.equal(
        existsSync(reportsDir),
        false,
        'none reporter must not create the reports directory'
      );
      strict.equal(
        result.stdout.trim(),
        '',
        'none reporter must not write to stdout'
      );
      strict.equal(
        result.stderr.trim(),
        '',
        'none reporter must not write to stderr'
      );
    });
  }
});
