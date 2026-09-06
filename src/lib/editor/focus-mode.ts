import { StateEffect, StateField, type Extension, type Range } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { blockRangeAt } from './commands';

export const setFocusMode = StateEffect.define<boolean>();

export const focusModeField = StateField.define<boolean>({
  create: () => false,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setFocusMode)) return effect.value;
    }
    return value;
  },
});

const dimmed = Decoration.line({ class: 'cm-dimmed-line' });

function buildDecorations(view: EditorView): DecorationSet {
  if (!view.state.field(focusModeField, false)) return Decoration.none;
  const head = view.state.selection.main.head;
  const currentLine = view.state.doc.lineAt(head).number - 1;
  const block = blockRangeAt(view.state.doc.toString(), currentLine);
  const marks: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      const index = line.number - 1;
      if (index < block.start || index > block.end) marks.push(dimmed.range(line.from));
      if (line.to + 1 > to) break;
      position = line.to + 1;
    }
  }
  return Decoration.set(marks, true);
}

export const focusPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      const toggled = update.transactions.some((t) =>
        t.effects.some((e) => e.is(setFocusMode)),
      );
      if (update.docChanged || update.selectionSet || update.viewportChanged || toggled) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations },
);

export function focusExtension(): Extension {
  return [focusModeField, focusPlugin];
}

export function applyFocusMode(view: EditorView, enabled: boolean): void {
  view.dispatch({ effects: setFocusMode.of(enabled) });
}

export function centreOnCursor(view: EditorView): void {
  const head = view.state.selection.main.head;
  const block = view.lineBlockAt(head);
  const target = block.top - view.scrollDOM.clientHeight / 2 + block.height / 2;
  view.scrollDOM.scrollTop = Math.max(0, target);
}
