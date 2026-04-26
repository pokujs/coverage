const SPACE = 0x20;
const TAB = 0x09;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const SLASH = 0x2f;
const STAR = 0x2a;
const SINGLE_QUOTE = 0x27;
const DOUBLE_QUOTE = 0x22;
const BACKTICK = 0x60;
const BACKSLASH = 0x5c;
const CLOSE_PAREN = 0x29;
const CLOSE_BRACE = 0x7d;
const CLOSE_BRACKET = 0x5d;
const SEMICOLON = 0x3b;
const COMMA = 0x2c;

const isDelimiterByte = (byteValue: number): boolean =>
  byteValue === CLOSE_PAREN ||
  byteValue === CLOSE_BRACE ||
  byteValue === CLOSE_BRACKET ||
  byteValue === SEMICOLON ||
  byteValue === COMMA;

const enum ScanState {
  Code,
  LineComment,
  BlockComment,
  SingleQuoteString,
  DoubleQuoteString,
  TemplateString,
}

const isWhitespace = (byteValue: number): boolean =>
  byteValue === SPACE ||
  byteValue === TAB ||
  byteValue === NEWLINE ||
  byteValue === CARRIAGE_RETURN;

const findCommentOnlyLines = (source: string): Set<number> => {
  const buffer = Buffer.from(source, 'utf8');
  const hadCode: boolean[] = [];
  const sawComment: boolean[] = [];
  let currentLine = 0;
  hadCode[0] = false;
  sawComment[0] = false;

  let state: ScanState = ScanState.Code;

  for (let byteIndex = 0; byteIndex < buffer.length; byteIndex++) {
    const byteValue = buffer[byteIndex];

    if (byteValue === NEWLINE) {
      if (state === ScanState.LineComment) state = ScanState.Code;
      currentLine++;
      hadCode[currentLine] = false;
      sawComment[currentLine] = false;
      continue;
    }

    switch (state) {
      case ScanState.Code: {
        if (isWhitespace(byteValue)) continue;

        if (byteValue === SLASH && buffer[byteIndex + 1] === SLASH) {
          state = ScanState.LineComment;
          sawComment[currentLine] = true;
          byteIndex++;
          continue;
        }

        if (byteValue === SLASH && buffer[byteIndex + 1] === STAR) {
          state = ScanState.BlockComment;
          sawComment[currentLine] = true;
          byteIndex++;
          continue;
        }

        hadCode[currentLine] = true;

        if (byteValue === SINGLE_QUOTE) state = ScanState.SingleQuoteString;
        else if (byteValue === DOUBLE_QUOTE)
          state = ScanState.DoubleQuoteString;
        else if (byteValue === BACKTICK) state = ScanState.TemplateString;

        continue;
      }

      case ScanState.LineComment:
        continue;

      case ScanState.BlockComment: {
        sawComment[currentLine] = true;
        if (byteValue === STAR && buffer[byteIndex + 1] === SLASH) {
          state = ScanState.Code;
          byteIndex++;
        }
        continue;
      }

      case ScanState.SingleQuoteString: {
        if (byteValue === BACKSLASH) {
          byteIndex++;
          continue;
        }
        if (byteValue === SINGLE_QUOTE) state = ScanState.Code;
        continue;
      }

      case ScanState.DoubleQuoteString: {
        if (byteValue === BACKSLASH) {
          byteIndex++;
          continue;
        }
        if (byteValue === DOUBLE_QUOTE) state = ScanState.Code;
        continue;
      }

      case ScanState.TemplateString: {
        if (byteValue === BACKSLASH) {
          byteIndex++;
          continue;
        }
        if (byteValue === BACKTICK) state = ScanState.Code;
        continue;
      }
    }
  }

  const commentOnlyLines = new Set<number>();

  for (let lineIndex = 0; lineIndex <= currentLine; lineIndex++) {
    if (sawComment[lineIndex] && !hadCode[lineIndex])
      commentOnlyLines.add(lineIndex + 1);
  }

  return commentOnlyLines;
};

const findDelimiterOnlyLines = (source: string): Set<number> => {
  const buffer = Buffer.from(source, 'utf8');
  const delimiterOnlyLines = new Set<number>();
  let currentLine = 1;
  let sawContent = false;
  let sawNonDelimiter = false;

  const finalizeLine = (): void => {
    if (sawContent && !sawNonDelimiter) delimiterOnlyLines.add(currentLine);
  };

  for (let byteIndex = 0; byteIndex < buffer.length; byteIndex++) {
    const byteValue = buffer[byteIndex];

    if (byteValue === NEWLINE) {
      finalizeLine();
      currentLine++;
      sawContent = false;
      sawNonDelimiter = false;
      continue;
    }

    if (isWhitespace(byteValue)) continue;

    sawContent = true;
    if (!isDelimiterByte(byteValue)) sawNonDelimiter = true;
  }

  finalizeLine();

  return delimiterOnlyLines;
};

export const sourceLines = {
  findCommentOnlyLines,
  findDelimiterOnlyLines,
} as const;
