import { expect, test } from '@jest/globals';
import { capitalize, reverse } from '../src/strings.ts';

test('capitalize uppercases the first letter', () => {
  expect(capitalize('hello')).toBe('Hello');
});

test('reverse flips a string', () => {
  expect(reverse('abc')).toBe('cba');
});
