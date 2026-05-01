import { assertEquals } from 'jsr:@std/assert';
import {
  chooseFirst,
  ensureBoth,
  guardedLength,
  withFallback,
  withNullishFallback,
} from '../src/partial.ts';

Deno.test('withFallback keeps the value when truthy', () => {
  assertEquals(withFallback('hello'), 'hello');
});

Deno.test('withNullishFallback keeps the value when non-nullish', () => {
  assertEquals(withNullishFallback('hello'), 'hello');
  assertEquals(withNullishFallback(0), 0);
});

Deno.test('ensureBoth returns b when a is truthy', () => {
  assertEquals(ensureBoth(1, 2), 2);
});

Deno.test('chooseFirst returns a when set', () => {
  assertEquals(chooseFirst('a', 'b', 'c'), 'a');
});

Deno.test('guardedLength returns length when text is truthy', () => {
  assertEquals(guardedLength('hi'), 2);
});
