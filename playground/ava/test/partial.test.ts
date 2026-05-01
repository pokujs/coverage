import test from 'ava';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.ts';

test('withFallback keeps the value when truthy', (t) => {
  t.is(withFallback('hello'), 'hello');
});

test('withNullishFallback keeps the value when non-nullish', (t) => {
  t.is(withNullishFallback('hello'), 'hello');
  t.is(withNullishFallback(0), 0);
});

test('ensureBoth returns b when a is truthy', (t) => {
  t.is(ensureBoth(1, 2), 2);
});

test('chooseFirst returns a when set', (t) => {
  t.is(chooseFirst('a', 'b', 'c'), 'a');
});

test('guardedLength returns length when text is truthy', (t) => {
  t.is(guardedLength('hi'), 2);
});
