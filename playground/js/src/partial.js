export function withFallback(value) {
  return value || 'fallback';
}

export function withNullishFallback(value) {
  return value ?? 'fallback';
}

export function ensureBoth(a, b) {
  return a && b;
}

export function chooseFirst(a, b, c) {
  return a || b || c || 'nothing';
}

export function guardedLength(text) {
  return text && text.length;
}
