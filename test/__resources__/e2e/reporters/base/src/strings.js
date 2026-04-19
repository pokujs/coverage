export function capitalize(str) {
  /* v8 ignore next 3 */
  if (typeof str !== 'string' || str.length === 0) {
    return '';
  }
  return str[0].toUpperCase() + str.slice(1);
}

export function reverse(str) {
  return str.split('').reverse().join('');
}

export function isPalindrome(str) {
  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === reverse(clean);
}
