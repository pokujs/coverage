import type { TestCase } from '../../../../src/@types/tests.ts';
import { isAbsolute } from 'node:path';
import { strict, test } from 'poku';
import { fixture } from '../../../__utils__/fixture.ts';
import { lcov } from '../../../__utils__/readers/lcov.ts';
import { runtimes } from '../../../__utils__/runtime.ts';
import { snapshot } from '../../../__utils__/snapshot.ts';

for (const runtime of runtimes) {
  const testCase: TestCase = {
    reporter: 'lcovonly',
    runtime,
    name: 'all',
    extension: 'json',
  };

  await test(`${runtime}: ${testCase.name}`, async () => {
    const result = await fixture.run(testCase);

    snapshot.matchJson(
      await lcov.extract(result.fixtureRoot, 'lcovonly'),
      testCase,
      'Covers all files included and excludes explicit ones'
    );

    const sourceFileLines = lcov
      .raw(result.fixtureRoot)
      .split('\n')
      .filter((rawLine) => rawLine.startsWith('SF:'));

    strict.ok(
      sourceFileLines.length > 0,
      `lcov.info should contain at least one SF`
    );

    for (const sourceFileLine of sourceFileLines) {
      const sourcePath = sourceFileLine.slice(3);

      strict.ok(
        !isAbsolute(sourcePath),
        `SF path should be relative to cwd: "${sourceFileLine}"`
      );
    }
  });
}
