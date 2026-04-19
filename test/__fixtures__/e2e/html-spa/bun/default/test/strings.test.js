import { strict as assert, test } from 'poku';
import { capitalize, reverse } from '../src/strings.js';

test('capitalize uppercases the first letter', () => {
  assert.equal(capitalize('hello'), 'Hello');
});

test('reverse flips a string', () => {
  assert.equal(reverse('abc'), 'cba');
});
