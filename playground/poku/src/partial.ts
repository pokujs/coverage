export function withFallback(value: string): string {
  return value || 'fallback';
}

export function withNullishFallback<T>(value: T): T | string {
  return value ?? 'fallback';
}

export function ensureBoth<A, B>(a: A, b: B): A | B {
  return (a && b) as A | B;
}

export function chooseFirst(a: string, b: string, c: string): string {
  return a || b || c || 'nothing';
}

export function guardedLength(text: string | null | undefined): number {
  return (text && text.length) as number;
}
