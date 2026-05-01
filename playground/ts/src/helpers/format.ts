export function wrap(
  value: string,
  prefix: string | undefined,
  suffix: string | undefined
): string {
  if (prefix === undefined) {
    return `${value}${suffix ?? ''}`;
  }
  if (suffix === undefined) {
    return `${prefix}${value}`;
  }
  return `${prefix}${value}${suffix}`;
}

export function indent(text: string, spaces: number): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => padding + line)
    .join('\n');
}
