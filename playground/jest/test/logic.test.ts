import { expect, test } from '@jest/globals';
import {
  allTruthy,
  askOrReturn,
  banner,
  classify,
  counter,
  describeUser,
  ensureArray,
  firstDefined,
  firstNonEmpty,
  greet,
  matchOrDefault,
  MODE,
  pickLabel,
} from '../src/logic.ts';

test('MODE resolves to a non-empty string via top-level ||', () => {
  expect(typeof MODE === 'string' && MODE.length > 0).toBe(true);
});

test('firstNonEmpty exercises every arm of the || chain', () => {
  expect(firstNonEmpty('a', 'b', 'c')).toBe('a');
  expect(firstNonEmpty('', 'b', 'c')).toBe('b');
  expect(firstNonEmpty('', '', 'c')).toBe('c');
  expect(firstNonEmpty('', '', '')).toBe('anonymous');
});

test('firstDefined exercises every arm of the ?? chain', () => {
  expect(firstDefined(1, 2, 3)).toBe(1);
  expect(firstDefined(null, 2, 3)).toBe(2);
  expect(firstDefined(null, undefined, 3)).toBe(3);
  expect(firstDefined(null, undefined, null)).toBe('fallback');
});

test('allTruthy short-circuits on the first falsy argument', () => {
  expect(allTruthy(true, true, true)).toBe(true);
  expect(allTruthy(false, true, true)).toBe(false);
  expect(allTruthy(true, false, true)).toBe(false);
  expect(allTruthy(true, true, false)).toBe(false);
});

test('classify nests two ternaries', () => {
  expect(classify(5)).toBe('positive');
  expect(classify(-3)).toBe('negative');
  expect(classify(0)).toBe('zero');
});

test('pickLabel hits all four nested-ternary arms', () => {
  expect(pickLabel(0)).toBe('none');
  expect(pickLabel(1)).toBe('one');
  expect(pickLabel(5)).toBe('many');
  expect(pickLabel(-1)).toBe('invalid');
});

test('describeUser combines ?., ??, && and ||', () => {
  expect(describeUser({ name: 'Ada', role: 'admin', verified: true })).toEqual({
    name: 'Ada',
    role: 'admin',
    verified: true,
  });
  expect(describeUser(undefined)).toEqual({
    name: 'anonymous',
    role: 'guest',
    verified: false,
  });
  expect(describeUser({ role: 'user' })).toEqual({
    name: 'anonymous',
    role: 'user',
    verified: false,
  });
});

test('greet runs || inside a template interpolation', () => {
  expect(greet('Ada', 'fallback')).toBe('Hello, Ada!');
  expect(greet('', 'fallback')).toBe('Hello, fallback!');
  expect(greet('', '')).toBe('Hello, stranger!');
});

test('banner ignores branch tokens inside the template static part', () => {
  expect(banner('Welcome').includes('Welcome')).toBe(true);
  expect(banner(null).includes('untitled')).toBe(true);
});

test('askOrReturn respects the ? inside the string literal', () => {
  expect(askOrReturn(true)).toBe('what?:now');
  expect(askOrReturn(false)).toBe('');
});

test('matchOrDefault uses a regex literal with pipe alternation', () => {
  expect(matchOrDefault('a', 'none')).toBe('a');
  expect(matchOrDefault('b', 'none')).toBe('b');
  expect(matchOrDefault('z', 'none')).toBe('none');
});

test('counter exercises && short-circuit even with line comment noise', () => {
  expect(counter(0)).toBe(0);
  expect(counter(5)).toBe(6);
});

test('ensureArray wraps non-array values, passes arrays through', () => {
  expect(ensureArray([1, 2])).toEqual([1, 2]);
  expect(ensureArray(42)).toEqual([42]);
});
