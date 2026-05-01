import test from 'ava';
import { chunk, sum, unique } from '../src/collections.ts';

test('unique removes duplicates', (t) => {
  t.deepEqual(unique([1, 1, 2, 3, 3]), [1, 2, 3]);
});

test('chunk splits an array into groups', (t) => {
  t.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('sum adds all numbers in an array', (t) => {
  t.is(sum([1, 2, 3, 4]), 10);
});
