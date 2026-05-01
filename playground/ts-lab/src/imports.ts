// Type-only imports — should be stripped to nothing.
import type { Session, User } from './types-only.ts';
import { makeUser } from './types-only.ts';

// Line 5 above is pure TS (gets erased)
// Line 6 above is runtime (stays)

export function authenticate(user: User): Session {
  return {
    userId: user.id,
    token: 'abc',
    expiresAt: Date.now(),
  };
}

export function createGuest(): User {
  return makeUser('guest-1', 'Guest', 'guest');
}
