export function untouched(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  return String(value);
}

export function alsoUntouched(list) {
  return list.map((item) => item.toUpperCase()).join(', ');
}
