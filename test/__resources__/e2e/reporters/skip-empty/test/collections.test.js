import { strict as assert, test } from 'poku';
import { chunk, sum, unique } from '../src/collections.js';

test('unique removes duplicates', () => {
  assert.deepEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3]);
});

test('chunk splits an array into groups', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('sum adds all numbers in an array', () => {
  assert.equal(sum([1, 2, 3, 4]), 10);
});

// Note: the chunk size<=0 error branch is intentionally uncovered.
