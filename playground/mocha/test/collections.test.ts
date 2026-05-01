import assert from 'node:assert/strict';
import { chunk, sum, unique } from '../src/collections.ts';

it('unique removes duplicates', () => {
  assert.deepEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3]);
});

it('chunk splits an array into groups', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

it('sum adds all numbers in an array', () => {
  assert.equal(sum([1, 2, 3, 4]), 10);
});
