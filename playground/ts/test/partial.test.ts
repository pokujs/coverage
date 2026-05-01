import { strict as assert, test } from 'poku';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.ts';

test('withFallback keeps the value when truthy', () => {
  assert.equal(withFallback('hello'), 'hello');
});

test('withNullishFallback keeps the value when non-nullish', () => {
  assert.equal(withNullishFallback('hello'), 'hello');
  assert.equal(withNullishFallback(0), 0);
});

test('ensureBoth returns b when a is truthy', () => {
  assert.equal(ensureBoth(1, 2), 2);
});

test('chooseFirst returns a when set', () => {
  assert.equal(chooseFirst('a', 'b', 'c'), 'a');
});

test('guardedLength returns length when text is truthy', () => {
  assert.equal(guardedLength('hi'), 2);
});
