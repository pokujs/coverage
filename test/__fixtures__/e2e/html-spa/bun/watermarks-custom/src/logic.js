export const MODE = process.env.PLAYGROUND_MODE || 'default';

export function firstNonEmpty(a, b, c) {
  return a || b || c || 'anonymous';
}

export function firstDefined(a, b, c) {
  return a ?? b ?? c ?? 'fallback';
}

export function allTruthy(a, b, c) {
  return a && b && c;
}

export function classify(value) {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
}

export function pickLabel(count) {
  return count === 0
    ? 'none'
    : count === 1
      ? 'one'
      : count > 1
        ? 'many'
        : 'invalid';
}

export function describeUser(user) {
  return {
    name: user?.name ?? 'anonymous',
    role: (user && user.role) || 'guest',
    verified: user?.verified === true,
  };
}

export function greet(name, fallback) {
  return `Hello, ${name || fallback || 'stranger'}!`;
}

export function banner(title) {
  return `=== ${title ?? 'untitled'} ===\n// this && that || theOther ?`;
}

export function askOrReturn(question) {
  const literal = 'what?:now';
  return question ? literal : '';
}

export function matchOrDefault(input, fallback) {
  const pattern = /a|b|c/;
  return pattern.test(input) ? input : fallback;
}

export function counter(start) {
  // previous && next && other — don't count me
  return start && start + 1;
}

export function ensureArray(value) {
  /*
   * Could have been `value || []` written inline, but we document the
   * `||` fallback in prose instead.
   */
  return Array.isArray(value) ? value : [value];
}
