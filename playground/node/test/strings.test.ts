import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capitalize, reverse } from '../src/strings.ts';

test('capitalize uppercases the first letter', () => {
  assert.equal(capitalize('hello'), 'Hello');
});

test('reverse flips a string', () => {
  assert.equal(reverse('abc'), 'cba');
});
