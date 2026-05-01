// Enums: regular vs const. Both compile differently.

export enum Status {
  Pending = 'pending',
  Active = 'active',
  Done = 'done',
}

export const enum Level {
  Low = 0,
  Medium = 1,
  High = 2,
}

export function describe(status: Status): string {
  if (status === Status.Pending) return 'waiting';
  if (status === Status.Active) return 'running';
  return 'finished';
}

export function rank(level: Level): string {
  if (level === Level.Low) return 'low';
  if (level === Level.Medium) return 'medium';
  return 'high';
}
