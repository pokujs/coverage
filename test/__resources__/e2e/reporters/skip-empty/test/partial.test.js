import { strict as assert, test } from 'poku';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.js';

test('withFallback keeps the value when truthy', () => {
  assert.equal(withFallback('hello'), 'hello');
  // Deliberately skipping withFallback('') — right arm of || stays untested.
});

test('withNullishFallback keeps the value when non-nullish', () => {
  assert.equal(withNullishFallback('hello'), 'hello');
  assert.equal(withNullishFallback(0), 0);
  // Deliberately skipping withNullishFallback(null) — right arm of ?? stays untested.
});

test('ensureBoth returns b when a is truthy', () => {
  assert.equal(ensureBoth(1, 2), 2);
  // Deliberately skipping ensureBoth(0, 2) — short-circuit arm of && stays untested.
});

test('chooseFirst returns a when set', () => {
  assert.equal(chooseFirst('a', 'b', 'c'), 'a');
  // Deliberately skipping every fallback — the chain of || stays mostly untested.
});

test('guardedLength returns length when text is truthy', () => {
  assert.equal(guardedLength('hi'), 2);
  // Deliberately skipping guardedLength(null) — short-circuit arm of && stays untested.
});
