import test from 'ava';
import { add, divide, multiply, subtract } from '../src/math.ts';

test('add sums two numbers', (t) => {
  t.is(add(2, 3), 5);
});

test('subtract returns the difference', (t) => {
  t.is(subtract(10, 4), 6);
});

test('multiply returns the product', (t) => {
  t.is(multiply(3, 4), 12);
});

test('divide returns the quotient', (t) => {
  t.is(divide(10, 2), 5);
});

test('divide throws when dividing by zero', (t) => {
  t.throws(() => divide(1, 0), { message: /Cannot divide by zero/ });
});
