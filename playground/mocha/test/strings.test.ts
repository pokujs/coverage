import assert from 'node:assert/strict';
import { capitalize, reverse } from '../src/strings.ts';

it('capitalize uppercases the first letter', () => {
  assert.equal(capitalize('hello'), 'Hello');
});

it('reverse flips a string', () => {
  assert.equal(reverse('abc'), 'cba');
});
