import { decodeString, type Token } from './tokens';

export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(outer: Matrix, inner: Matrix): Matrix {
  return [
    inner[0] * outer[0] + inner[1] * outer[2],
    inner[0] * outer[1] + inner[1] * outer[3],
    inner[2] * outer[0] + inner[3] * outer[2],
    inner[2] * outer[1] + inner[3] * outer[3],
    inner[4] * outer[0] + inner[5] * outer[2] + outer[4],
    inner[4] * outer[1] + inner[5] * outer[3] + outer[5],
  ];
}

export function translation(x: number, y: number): Matrix {
  return [1, 0, 0, 1, x, y];
}

export interface FontMetrics {
  widthOf(code: number): number;
  measurable: boolean;
}

export type FontLookup = (name: string) => FontMetrics | null;

export interface TextRun {
  index: number;
  operator: string;
  firstToken: number;
  lastToken: number;
  stringTokens: number[];
  bytes: string;
  font: string;
  size: number;
  charSpacing: number;
  wordSpacing: number;
  horizontal: number;
  matrix: Matrix;
  advance: number;
  measured: boolean;
}

interface State {
  ctm: Matrix;
  tm: Matrix;
  lm: Matrix;
  font: string;
  size: number;
  charSpacing: number;
  wordSpacing: number;
  horizontal: number;
  leading: number;
}

function fresh(): State {
  return {
    ctm: IDENTITY,
    tm: IDENTITY,
    lm: IDENTITY,
    font: '',
    size: 0,
    charSpacing: 0,
    wordSpacing: 0,
    horizontal: 1,
    leading: 0,
  };
}

function numbersBefore(tokens: Token[], at: number, count: number): number[] {
  const values: number[] = [];
  for (let index = at - 1; index >= 0 && values.length < count; index -= 1) {
    const token = tokens[index]!;
    if (token.kind === 'comment') continue;
    if (token.kind !== 'number') break;
    values.unshift(Number(token.text));
  }
  return values.length === count ? values : [];
}

export function advanceOf(
  bytes: string,
  metrics: FontMetrics | null,
  size: number,
  charSpacing: number,
  wordSpacing: number,
  horizontal: number,
): number {
  if (!metrics) return 0;
  let total = 0;
  for (const char of bytes) {
    const code = char.charCodeAt(0);
    total += (metrics.widthOf(code) / 1000) * size + charSpacing;
    if (code === 32) total += wordSpacing;
  }
  return total * horizontal;
}

export function findRuns(tokens: Token[], fonts: FontLookup): TextRun[] {
  const runs: TextRun[] = [];
  const stack: Matrix[] = [];
  let state = fresh();
  let index = 0;

  const show = (
    operator: string,
    firstToken: number,
    lastToken: number,
    stringTokens: number[],
    adjustments: number,
  ): void => {
    const metrics = fonts(state.font);
    const bytes = stringTokens.map((at) => decodeString(tokens[at]!)).join('');
    const advance =
      advanceOf(
        bytes,
        metrics,
        state.size,
        state.charSpacing,
        state.wordSpacing,
        state.horizontal,
      ) -
      (adjustments / 1000) * state.size * state.horizontal;

    runs.push({
      index: runs.length,
      operator,
      firstToken,
      lastToken,
      stringTokens,
      bytes,
      font: state.font,
      size: state.size,
      charSpacing: state.charSpacing,
      wordSpacing: state.wordSpacing,
      horizontal: state.horizontal,
      matrix: multiply(state.ctm, state.tm),
      advance,
      measured: metrics?.measurable === true,
    });

    state.tm = multiply(state.tm, translation(advance, 0));
  };

  while (index < tokens.length) {
    const token = tokens[index]!;
    if (token.kind !== 'operator') {
      index += 1;
      continue;
    }

    const operator = token.text;

    if (operator === 'q') {
      stack.push(state.ctm);
    } else if (operator === 'Q') {
      state.ctm = stack.pop() ?? IDENTITY;
    } else if (operator === 'cm') {
      const values = numbersBefore(tokens, index, 6);
      if (values.length === 6) state.ctm = multiply(state.ctm, values as Matrix);
    } else if (operator === 'BT') {
      state.tm = IDENTITY;
      state.lm = IDENTITY;
    } else if (operator === 'Tf') {
      const size = numbersBefore(tokens, index, 1);
      const name = tokens[index - 2];
      if (size.length === 1) state.size = size[0]!;
      if (name?.kind === 'name') state.font = name.text.slice(1);
    } else if (operator === 'Tc') {
      const values = numbersBefore(tokens, index, 1);
      if (values.length === 1) state.charSpacing = values[0]!;
    } else if (operator === 'Tw') {
      const values = numbersBefore(tokens, index, 1);
      if (values.length === 1) state.wordSpacing = values[0]!;
    } else if (operator === 'Tz') {
      const values = numbersBefore(tokens, index, 1);
      if (values.length === 1) state.horizontal = values[0]! / 100;
    } else if (operator === 'TL') {
      const values = numbersBefore(tokens, index, 1);
      if (values.length === 1) state.leading = values[0]!;
    } else if (operator === 'Td' || operator === 'TD') {
      const values = numbersBefore(tokens, index, 2);
      if (values.length === 2) {
        if (operator === 'TD') state.leading = -values[1]!;
        state.lm = multiply(state.lm, translation(values[0]!, values[1]!));
        state.tm = state.lm;
      }
    } else if (operator === 'Tm') {
      const values = numbersBefore(tokens, index, 6);
      if (values.length === 6) {
        state.lm = values as Matrix;
        state.tm = values as Matrix;
      }
    } else if (operator === 'T*') {
      state.lm = multiply(state.lm, translation(0, -state.leading));
      state.tm = state.lm;
    } else if (operator === 'Tj' || operator === "'" || operator === '"') {
      if (operator !== 'Tj') {
        if (operator === '"') {
          const values = numbersBefore(tokens, index - 1, 2);
          if (values.length === 2) {
            state.wordSpacing = values[0]!;
            state.charSpacing = values[1]!;
          }
        }
        state.lm = multiply(state.lm, translation(0, -state.leading));
        state.tm = state.lm;
      }
      const at = index - 1;
      const previous = tokens[at];
      if (previous && (previous.kind === 'string' || previous.kind === 'hex')) {
        show(operator, at, index, [at], 0);
      }
    } else if (operator === 'TJ') {
      let open = index - 1;
      while (open >= 0 && tokens[open]!.kind !== 'open-array') open -= 1;
      if (open >= 0) {
        const stringTokens: number[] = [];
        let adjustments = 0;
        for (let at = open + 1; at < index - 1; at += 1) {
          const entry = tokens[at]!;
          if (entry.kind === 'string' || entry.kind === 'hex') stringTokens.push(at);
          else if (entry.kind === 'number') adjustments += Number(entry.text);
        }
        show('TJ', open, index, stringTokens, adjustments);
      }
    }

    index += 1;
  }

  return runs;
}

export function originOf(run: TextRun): { x: number; y: number } {
  return { x: run.matrix[4], y: run.matrix[5] };
}
