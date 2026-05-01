import test from 'ava';
import { capitalize, reverse } from '../src/strings.ts';

test('capitalize uppercases the first letter', (t) => {
  t.is(capitalize('hello'), 'Hello');
});

test('reverse flips a string', (t) => {
  t.is(reverse('abc'), 'cba');
});
