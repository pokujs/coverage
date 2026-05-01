// Decorators generate extra JS at class body — hostile to line-alignment.

function log(target: unknown, propertyKey: string): void {
  void target;
  void propertyKey;
}

export class Service {
  @log
  doWork(value: number): number {
    return value * 2;
  }

  @log
  verify(): boolean {
    return true;
  }
}

export function useService(): number {
  const service = new Service();
  return service.doWork(21);
}
