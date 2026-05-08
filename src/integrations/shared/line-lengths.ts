const compute = (code: string): number[] => {
  const lengths: number[] = [];
  let lineStart = 0;

  for (let charIndex = 0; charIndex < code.length; charIndex++) {
    if (code.charCodeAt(charIndex) === 10) {
      lengths.push(charIndex - lineStart);

      lineStart = charIndex + 1;
    }
  }

  lengths.push(code.length - lineStart);
  return lengths;
};

export const lineLengths = { compute } as const;
