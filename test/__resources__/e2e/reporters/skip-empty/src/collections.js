export function unique(arr) {
  return Array.from(new Set(arr));
}

export function chunk(arr, size) {
  if (size <= 0) {
    throw new Error('size must be greater than zero');
  }
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function sum(arr) {
  return arr.reduce((acc, n) => acc + n, 0);
}
