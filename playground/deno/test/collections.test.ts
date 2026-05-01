import { assertEquals } from 'jsr:@std/assert';
import { chunk, sum, unique } from '../src/collections.ts';

Deno.test('unique removes duplicates', () => {
  assertEquals(unique([1, 1, 2, 3, 3]), [1, 2, 3]);
});

Deno.test('chunk splits an array into groups', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

Deno.test('sum adds all numbers in an array', () => {
  assertEquals(sum([1, 2, 3, 4]), 10);
});
