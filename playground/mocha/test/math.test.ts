import assert from 'node:assert/strict';
import { add, divide, multiply, subtract } from '../src/math.ts';

it('add sums two numbers', () => {
  assert.equal(add(2, 3), 5);
});

it('subtract returns the difference', () => {
  assert.equal(subtract(10, 4), 6);
});

it('multiply returns the product', () => {
  assert.equal(multiply(3, 4), 12);
});

it('divide returns the quotient', () => {
  assert.equal(divide(10, 2), 5);
});

it('divide throws when dividing by zero', () => {
  assert.throws(() => divide(1, 0), /Cannot divide by zero/);
});
