import { assertEquals, assertThrows } from 'jsr:@std/assert';
import { add, divide, multiply, subtract } from '../src/math.ts';

Deno.test('add sums two numbers', () => {
  assertEquals(add(2, 3), 5);
});

Deno.test('subtract returns the difference', () => {
  assertEquals(subtract(10, 4), 6);
});

Deno.test('multiply returns the product', () => {
  assertEquals(multiply(3, 4), 12);
});

Deno.test('divide returns the quotient', () => {
  assertEquals(divide(10, 2), 5);
});

Deno.test('divide throws when dividing by zero', () => {
  assertThrows(() => divide(1, 0), Error, 'Cannot divide by zero');
});
