import assert from 'node:assert/strict';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.ts';

it('withFallback keeps the value when truthy', () => {
  assert.equal(withFallback('hello'), 'hello');
});

it('withNullishFallback keeps the value when non-nullish', () => {
  assert.equal(withNullishFallback('hello'), 'hello');
  assert.equal(withNullishFallback(0), 0);
});

it('ensureBoth returns b when a is truthy', () => {
  assert.equal(ensureBoth(1, 2), 2);
});

it('chooseFirst returns a when set', () => {
  assert.equal(chooseFirst('a', 'b', 'c'), 'a');
});

it('guardedLength returns length when text is truthy', () => {
  assert.equal(guardedLength('hi'), 2);
});
