import { strict as assert, test } from 'poku';
import { add, divide, multiply, subtract } from '../src/math.js';

test('add sums two numbers', () => {
  assert.equal(add(2, 3), 5);
});

test('subtract returns the difference', () => {
  assert.equal(subtract(10, 4), 6);
});

test('multiply returns the product', () => {
  assert.equal(multiply(3, 4), 12);
});

test('divide returns the quotient', () => {
  assert.equal(divide(10, 2), 5);
});

test('divide throws when dividing by zero', () => {
  assert.throws(() => divide(1, 0), /Cannot divide by zero/);
});
