import { expect, test } from '@jest/globals';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.ts';

test('withFallback keeps the value when truthy', () => {
  expect(withFallback('hello')).toBe('hello');
});

test('withNullishFallback keeps the value when non-nullish', () => {
  expect(withNullishFallback('hello')).toBe('hello');
  expect(withNullishFallback(0)).toBe(0);
});

test('ensureBoth returns b when a is truthy', () => {
  expect(ensureBoth(1, 2)).toBe(2);
});

test('chooseFirst returns a when set', () => {
  expect(chooseFirst('a', 'b', 'c')).toBe('a');
});

test('guardedLength returns length when text is truthy', () => {
  expect(guardedLength('hi')).toBe(2);
});
