import { strict as assert, test } from 'poku';
import { greet } from '../src/survivor.js';
import { identity, twice } from '../src/transpiled.js';

test('identity returns value', () => {
  assert.equal(identity(42), 42);
});

test('twice doubles value', () => {
  assert.equal(twice(3), 6);
});

test('greet formats name', () => {
  assert.equal(greet('world'), 'hello, world');
});
