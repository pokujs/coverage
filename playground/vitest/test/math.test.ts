import { expect, test } from 'vitest';
import { add, divide, multiply, subtract } from '../src/math.ts';

test('add sums two numbers', () => {
  expect(add(2, 3)).toBe(5);
});

test('subtract returns the difference', () => {
  expect(subtract(10, 4)).toBe(6);
});

test('multiply returns the product', () => {
  expect(multiply(3, 4)).toBe(12);
});

test('divide returns the quotient', () => {
  expect(divide(10, 2)).toBe(5);
});

test('divide throws when dividing by zero', () => {
  expect(() => divide(1, 0)).toThrow(/Cannot divide by zero/);
});
