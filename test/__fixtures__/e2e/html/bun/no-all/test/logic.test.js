import { strict as assert, test } from 'poku';
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
} from '../src/logic.js';

test('MODE resolves to a non-empty string via top-level ||', () => {
  assert.ok(typeof MODE === 'string' && MODE.length > 0);
});

test('firstNonEmpty exercises every arm of the || chain', () => {
  assert.equal(firstNonEmpty('a', 'b', 'c'), 'a');
  assert.equal(firstNonEmpty('', 'b', 'c'), 'b');
  assert.equal(firstNonEmpty('', '', 'c'), 'c');
  assert.equal(firstNonEmpty('', '', ''), 'anonymous');
});

test('firstDefined exercises every arm of the ?? chain', () => {
  assert.equal(firstDefined(1, 2, 3), 1);
  assert.equal(firstDefined(null, 2, 3), 2);
  assert.equal(firstDefined(null, undefined, 3), 3);
  assert.equal(firstDefined(null, undefined, null), 'fallback');
});

test('allTruthy short-circuits on the first falsy argument', () => {
  assert.equal(allTruthy(true, true, true), true);
  assert.equal(allTruthy(false, true, true), false);
  assert.equal(allTruthy(true, false, true), false);
  assert.equal(allTruthy(true, true, false), false);
});

test('classify nests two ternaries', () => {
  assert.equal(classify(5), 'positive');
  assert.equal(classify(-3), 'negative');
  assert.equal(classify(0), 'zero');
});

test('pickLabel hits all four nested-ternary arms', () => {
  assert.equal(pickLabel(0), 'none');
  assert.equal(pickLabel(1), 'one');
  assert.equal(pickLabel(5), 'many');
  assert.equal(pickLabel(-1), 'invalid');
});

test('describeUser combines ?., ??, && and ||', () => {
  assert.deepEqual(
    describeUser({ name: 'Ada', role: 'admin', verified: true }),
    { name: 'Ada', role: 'admin', verified: true }
  );
  assert.deepEqual(describeUser(undefined), {
    name: 'anonymous',
    role: 'guest',
    verified: false,
  });
  assert.deepEqual(describeUser({ role: 'user' }), {
    name: 'anonymous',
    role: 'user',
    verified: false,
  });
});

test('greet runs || inside a template interpolation', () => {
  assert.equal(greet('Ada', 'fallback'), 'Hello, Ada!');
  assert.equal(greet('', 'fallback'), 'Hello, fallback!');
  assert.equal(greet('', ''), 'Hello, stranger!');
});

test('banner ignores branch tokens inside the template static part', () => {
  assert.ok(banner('Welcome').includes('Welcome'));
  assert.ok(banner(null).includes('untitled'));
});

test('askOrReturn respects the ? inside the string literal', () => {
  assert.equal(askOrReturn(true), 'what?:now');
  assert.equal(askOrReturn(false), '');
});

test('matchOrDefault uses a regex literal with pipe alternation', () => {
  assert.equal(matchOrDefault('a', 'none'), 'a');
  assert.equal(matchOrDefault('b', 'none'), 'b');
  assert.equal(matchOrDefault('z', 'none'), 'none');
});

test('counter exercises && short-circuit even with line comment noise', () => {
  assert.equal(counter(0), 0);
  assert.equal(counter(5), 6);
});

test('ensureArray wraps non-array values, passes arrays through', () => {
  assert.deepEqual(ensureArray([1, 2]), [1, 2]);
  assert.deepEqual(ensureArray(42), [42]);
});
