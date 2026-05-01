export const MODE: string = process.env.PLAYGROUND_MODE || 'default';

export function firstNonEmpty(a: string, b: string, c: string): string {
  return a || b || c || 'anonymous';
}

export function firstDefined<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  c: T | null | undefined
): T | string {
  return a ?? b ?? c ?? 'fallback';
}

export function allTruthy(a: unknown, b: unknown, c: unknown): unknown {
  return a && b && c;
}

export function classify(value: number): string {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
}

export function pickLabel(count: number): string {
  return count === 0
    ? 'none'
    : count === 1
      ? 'one'
      : count > 1
        ? 'many'
        : 'invalid';
}

type UserInput = { name?: string; role?: string; verified?: boolean };

export function describeUser(user: UserInput | null | undefined) {
  return {
    name: user?.name ?? 'anonymous',
    role: (user && user.role) || 'guest',
    verified: user?.verified === true,
  };
}

export function greet(name: string, fallback: string): string {
  return `Hello, ${name || fallback || 'stranger'}!`;
}

export function banner(title: string | null | undefined): string {
  return `=== ${title ?? 'untitled'} ===\n// this && that || theOther ?`;
}

export function askOrReturn(question: boolean): string {
  const literal = 'what?:now';
  return question ? literal : '';
}

export function matchOrDefault(input: string, fallback: string): string {
  const pattern = /a|b|c/;
  return pattern.test(input) ? input : fallback;
}

export function counter(start: number): number {
  // previous && next && other — don't count me
  return start && start + 1;
}

export function ensureArray<T>(value: T | T[]): T[] {
  /*
   * Could have been `value || []` written inline, but we document the
   * `||` fallback in prose instead.
   */
  return Array.isArray(value) ? value : [value];
}
