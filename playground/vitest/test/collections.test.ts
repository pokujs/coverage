import { expect, test } from 'vitest';
import { chunk, sum, unique } from '../src/collections.ts';

test('unique removes duplicates', () => {
  expect(unique([1, 1, 2, 3, 3])).toEqual([1, 2, 3]);
});

test('chunk splits an array into groups', () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test('sum adds all numbers in an array', () => {
  expect(sum([1, 2, 3, 4])).toBe(10);
});
