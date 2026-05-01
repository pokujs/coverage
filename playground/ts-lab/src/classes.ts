// Plain class without decorators: does it hit the same bug?

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  double(value: number): number {
    return value * 2;
  }

  emptyCheck(): boolean {
    return true;
  }
}

export function useCalculator(): number {
  const calc = new Calculator();
  return calc.add(calc.double(21), calc.emptyCheck() ? 0 : 99);
}
