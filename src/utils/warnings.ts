const seen = new Set<string>();

const once = (warningKey: string, message: string): void => {
  if (seen.has(warningKey)) return;

  seen.add(warningKey);
  console.warn(message);
};

export const warnings = { once } as const;
