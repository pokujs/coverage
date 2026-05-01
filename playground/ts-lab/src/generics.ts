// Generics with long signatures that span multiple lines in TS.

export function identity<T>(value: T): T {
  return value;
}

export function mapArray<
  Input,
  Output
>(
  items: ReadonlyArray<Input>,
  transform: (item: Input, index: number) => Output
): Output[] {
  return items.map(transform);
}

export function narrow<T extends { kind: string }>(
  value: T,
  kind: T['kind']
): T | null {
  if (value.kind === kind) {
    return value;
  }
  return null;
}

// Conditional type — zero runtime
export type NonNullable2<T> = T extends null | undefined ? never : T;

// Mapped type — zero runtime
export type Readonly2<T> = {
  readonly [K in keyof T]: T[K];
};
