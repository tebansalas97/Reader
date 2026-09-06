import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { isMisspelled, spellingReady, type SpellLanguage } from './spell';
import { tokenizeWords } from './spell-tokens';

export interface SpellConfig {
  enabled: boolean;
  language: SpellLanguage;
}

export const setSpellConfig = StateEffect.define<SpellConfig>();

export const spellConfigField = StateField.define<SpellConfig>({
  create: () => ({ enabled: false, language: 'es' }),
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSpellConfig)) return effect.value;
    }
    return value;
  },
});

const misspelledMark = Decoration.mark({ class: 'cm-misspelled' });

function buildDecorations(view: EditorView): DecorationSet {
  const config = view.state.field(spellConfigField, false);
  if (!config?.enabled || !spellingReady(config.language)) return Decoration.none;

  const marks: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.sliceDoc(from, to);
    for (const token of tokenizeWords(text, from)) {
      if (isMisspelled(token.word, config.language)) {
        marks.push(misspelledMark.range(token.from, token.to));
      }
    }
  }
  return Decoration.set(marks, true);
}

export const spellPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      const configChanged = update.transactions.some((t) =>
        t.effects.some((e) => e.is(setSpellConfig)),
      );
      if (update.docChanged || update.viewportChanged || configChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations },
);

export function spellExtension(): Extension {
  return [spellConfigField, spellPlugin];
}

export function refreshSpelling(view: EditorView, config: SpellConfig): void {
  view.dispatch({ effects: setSpellConfig.of(config) });
}

export interface MisspelledHit {
  from: number;
  to: number;
  word: string;
}

export function misspelledAt(view: EditorView, position: number): MisspelledHit | null {
  const config = view.state.field(spellConfigField, false);
  if (!config?.enabled || !spellingReady(config.language)) return null;
  const line = view.state.doc.lineAt(position);
  for (const token of tokenizeWords(line.text, line.from)) {
    if (position < token.from || position > token.to) continue;
    if (isMisspelled(token.word, config.language)) return token;
  }
  return null;
}
