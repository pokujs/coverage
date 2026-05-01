export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('size must be greater than zero');
  }
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function sum(arr: number[]): number {
  return arr.reduce((acc, n) => acc + n, 0);
}
