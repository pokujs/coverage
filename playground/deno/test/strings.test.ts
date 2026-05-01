import { assertEquals } from 'jsr:@std/assert';
import { capitalize, reverse } from '../src/strings.ts';

Deno.test('capitalize uppercases the first letter', () => {
  assertEquals(capitalize('hello'), 'Hello');
});

Deno.test('reverse flips a string', () => {
  assertEquals(reverse('abc'), 'cba');
});
