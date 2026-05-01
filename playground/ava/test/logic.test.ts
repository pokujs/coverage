import test from 'ava';
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

test('MODE resolves to a non-empty string via top-level ||', (t) => {
  t.true(typeof MODE === 'string' && MODE.length > 0);
});

test('firstNonEmpty exercises every arm of the || chain', (t) => {
  t.is(firstNonEmpty('a', 'b', 'c'), 'a');
  t.is(firstNonEmpty('', 'b', 'c'), 'b');
  t.is(firstNonEmpty('', '', 'c'), 'c');
  t.is(firstNonEmpty('', '', ''), 'anonymous');
});

test('firstDefined exercises every arm of the ?? chain', (t) => {
  t.is(firstDefined(1, 2, 3), 1);
  t.is(firstDefined(null, 2, 3), 2);
  t.is(firstDefined(null, undefined, 3), 3);
  t.is(firstDefined(null, undefined, null), 'fallback');
});

test('allTruthy short-circuits on the first falsy argument', (t) => {
  t.is(allTruthy(true, true, true), true);
  t.is(allTruthy(false, true, true), false);
  t.is(allTruthy(true, false, true), false);
  t.is(allTruthy(true, true, false), false);
});

test('classify nests two ternaries', (t) => {
  t.is(classify(5), 'positive');
  t.is(classify(-3), 'negative');
  t.is(classify(0), 'zero');
});

test('pickLabel hits all four nested-ternary arms', (t) => {
  t.is(pickLabel(0), 'none');
  t.is(pickLabel(1), 'one');
  t.is(pickLabel(5), 'many');
  t.is(pickLabel(-1), 'invalid');
});

test('describeUser combines ?., ??, && and ||', (t) => {
  t.deepEqual(
    describeUser({ name: 'Ada', role: 'admin', verified: true }),
    { name: 'Ada', role: 'admin', verified: true }
  );
  t.deepEqual(describeUser(undefined), {
    name: 'anonymous',
    role: 'guest',
    verified: false,
  });
  t.deepEqual(describeUser({ role: 'user' }), {
    name: 'anonymous',
    role: 'user',
    verified: false,
  });
});

test('greet runs || inside a template interpolation', (t) => {
  t.is(greet('Ada', 'fallback'), 'Hello, Ada!');
  t.is(greet('', 'fallback'), 'Hello, fallback!');
  t.is(greet('', ''), 'Hello, stranger!');
});

test('banner ignores branch tokens inside the template static part', (t) => {
  t.true(banner('Welcome').includes('Welcome'));
  t.true(banner(null).includes('untitled'));
});

test('askOrReturn respects the ? inside the string literal', (t) => {
  t.is(askOrReturn(true), 'what?:now');
  t.is(askOrReturn(false), '');
});

test('matchOrDefault uses a regex literal with pipe alternation', (t) => {
  t.is(matchOrDefault('a', 'none'), 'a');
  t.is(matchOrDefault('b', 'none'), 'b');
  t.is(matchOrDefault('z', 'none'), 'none');
});

test('counter exercises && short-circuit even with line comment noise', (t) => {
  t.is(counter(0), 0);
  t.is(counter(5), 6);
});

test('ensureArray wraps non-array values, passes arrays through', (t) => {
  t.deepEqual(ensureArray([1, 2]), [1, 2]);
  t.deepEqual(ensureArray(42), [42]);
});
