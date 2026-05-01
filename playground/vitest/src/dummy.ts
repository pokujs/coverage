export function untouched(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  return String(value);
}

export function alsoUntouched(list: string[]): string {
  return list.map((item) => item.toUpperCase()).join(', ');
}
