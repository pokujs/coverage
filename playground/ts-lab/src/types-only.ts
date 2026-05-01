// This file has many lines of pure TS that produce zero JS.
// Investigation target: how does Bun map blocks to these lines?

export type UserId = string;
export type UserName = string;

export type Role = 'admin' | 'user' | 'guest';

export type User = {
  id: UserId;
  name: UserName;
  role: Role;
};

export interface Session {
  userId: UserId;
  token: string;
  expiresAt: number;
}

export interface Auth {
  session: Session | null;
  login(): void;
  logout(): void;
}

// ─── Only line 28 produces runtime JS below ─────────────────────────────────
export function makeUser(id: UserId, name: UserName, role: Role): User {
  return { id, name, role };
}

export function isAdmin(user: User): boolean {
  return user.role === 'admin';
}

// ─── Another all-TS block ───────────────────────────────────────────────────
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Handler<T> = (value: T) => void;

// ─── Runtime again ──────────────────────────────────────────────────────────
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
