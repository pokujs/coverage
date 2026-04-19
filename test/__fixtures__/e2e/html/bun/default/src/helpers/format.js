export function wrap(value, prefix, suffix) {
  if (prefix === undefined) {
    return `${value}${suffix ?? ''}`;
  }
  if (suffix === undefined) {
    return `${prefix}${value}`;
  }
  return `${prefix}${value}${suffix}`;
}

export function indent(text, spaces) {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => padding + line)
    .join('\n');
}
