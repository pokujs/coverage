import { assert, assertEquals } from 'jsr:@std/assert';
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

Deno.test('MODE resolves to a non-empty string via top-level ||', () => {
  assert(typeof MODE === 'string' && MODE.length > 0);
});

Deno.test('firstNonEmpty exercises every arm of the || chain', () => {
  assertEquals(firstNonEmpty('a', 'b', 'c'), 'a');
  assertEquals(firstNonEmpty('', 'b', 'c'), 'b');
  assertEquals(firstNonEmpty('', '', 'c'), 'c');
  assertEquals(firstNonEmpty('', '', ''), 'anonymous');
});

Deno.test('firstDefined exercises every arm of the ?? chain', () => {
  assertEquals(firstDefined(1, 2, 3), 1);
  assertEquals(firstDefined(null, 2, 3), 2);
  assertEquals(firstDefined(null, undefined, 3), 3);
  assertEquals(firstDefined(null, undefined, null), 'fallback');
});

Deno.test('allTruthy short-circuits on the first falsy argument', () => {
  assertEquals(allTruthy(true, true, true), true);
  assertEquals(allTruthy(false, true, true), false);
  assertEquals(allTruthy(true, false, true), false);
  assertEquals(allTruthy(true, true, false), false);
});

Deno.test('classify nests two ternaries', () => {
  assertEquals(classify(5), 'positive');
  assertEquals(classify(-3), 'negative');
  assertEquals(classify(0), 'zero');
});

Deno.test('pickLabel hits all four nested-ternary arms', () => {
  assertEquals(pickLabel(0), 'none');
  assertEquals(pickLabel(1), 'one');
  assertEquals(pickLabel(5), 'many');
  assertEquals(pickLabel(-1), 'invalid');
});

Deno.test('describeUser combines ?., ??, && and ||', () => {
  assertEquals(
    describeUser({ name: 'Ada', role: 'admin', verified: true }),
    { name: 'Ada', role: 'admin', verified: true }
  );
  assertEquals(describeUser(undefined), {
    name: 'anonymous',
    role: 'guest',
    verified: false,
  });
  assertEquals(describeUser({ role: 'user' }), {
    name: 'anonymous',
    role: 'user',
    verified: false,
  });
});

Deno.test('greet runs || inside a template interpolation', () => {
  assertEquals(greet('Ada', 'fallback'), 'Hello, Ada!');
  assertEquals(greet('', 'fallback'), 'Hello, fallback!');
  assertEquals(greet('', ''), 'Hello, stranger!');
});

Deno.test('banner ignores branch tokens inside the template static part', () => {
  assert(banner('Welcome').includes('Welcome'));
  assert(banner(null).includes('untitled'));
});

Deno.test('askOrReturn respects the ? inside the string literal', () => {
  assertEquals(askOrReturn(true), 'what?:now');
  assertEquals(askOrReturn(false), '');
});

Deno.test('matchOrDefault uses a regex literal with pipe alternation', () => {
  assertEquals(matchOrDefault('a', 'none'), 'a');
  assertEquals(matchOrDefault('b', 'none'), 'b');
  assertEquals(matchOrDefault('z', 'none'), 'none');
});

Deno.test('counter exercises && short-circuit even with line comment noise', () => {
  assertEquals(counter(0), 0);
  assertEquals(counter(5), 6);
});

Deno.test('ensureArray wraps non-array values, passes arrays through', () => {
  assertEquals(ensureArray([1, 2]), [1, 2]);
  assertEquals(ensureArray(42), [42]);
});
