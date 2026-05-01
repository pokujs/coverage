import { strict as assert, test } from 'poku';
import { isAdmin, makeUser, ok, err } from '../src/types-only.ts';
import { identity, mapArray, narrow } from '../src/generics.ts';
import { Status, describe, Level, rank } from '../src/enums.ts';
import { Service, useService } from '../src/decorators.ts';
import { authenticate, createGuest } from '../src/imports.ts';
import { Calculator, useCalculator } from '../src/classes.ts';

test('types-only runtime', () => {
  const user = makeUser('1', 'Alice', 'admin');
  assert.ok(isAdmin(user));
  assert.equal(ok(42).ok, true);
  assert.equal(err(new Error('x')).ok, false);
});

test('generics', () => {
  assert.equal(identity(5), 5);
  assert.deepEqual(mapArray([1, 2, 3], (n) => n * 2), [2, 4, 6]);
  const widget = { kind: 'widget' as const, label: 'w' };
  assert.equal(narrow(widget, 'widget'), widget);
  assert.equal(narrow(widget, 'other' as 'widget'), null);
});

test('enums', () => {
  assert.equal(describe(Status.Pending), 'waiting');
  assert.equal(describe(Status.Active), 'running');
  assert.equal(describe(Status.Done), 'finished');
  assert.equal(rank(Level.Low), 'low');
  assert.equal(rank(Level.Medium), 'medium');
  assert.equal(rank(Level.High), 'high');
});

test('decorators', () => {
  assert.equal(useService(), 42);
  const svc = new Service();
  assert.equal(svc.verify(), true);
});

test('imports', () => {
  const g = createGuest();
  assert.equal(g.role, 'guest');
  const s = authenticate(g);
  assert.equal(s.userId, 'guest-1');
});

test('plain class methods (no decorators)', () => {
  assert.equal(useCalculator(), 42);
  const calc = new Calculator();
  assert.equal(calc.add(1, 2), 3);
  assert.equal(calc.double(10), 20);
  assert.equal(calc.emptyCheck(), true);
});
