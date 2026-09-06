import {
  copyLineDown,
  deleteLine,
  indentLess,
  indentMore,
  moveLineDown,
  moveLineUp,
  selectLine,
} from '@codemirror/commands';
import { selectNextOccurrence } from '@codemirror/search';
import type { KeyBinding } from '@codemirror/view';
import { continueList, insertLink, toggleHeading, toggleLinePrefix, toggleWrap } from './commands';

export const readerKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
  { key: 'Mod-`', run: (v) => toggleWrap(v, '`') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
  { key: 'Mod-k', run: (v) => insertLink(v) },
  { key: 'Mod-1', run: (v) => toggleHeading(v, 1) },
  { key: 'Mod-2', run: (v) => toggleHeading(v, 2) },
  { key: 'Mod-3', run: (v) => toggleHeading(v, 3) },
  { key: 'Mod-4', run: (v) => toggleHeading(v, 4) },
  { key: 'Mod-5', run: (v) => toggleHeading(v, 5) },
  { key: 'Mod-6', run: (v) => toggleHeading(v, 6) },
  { key: 'Mod-Shift-l', run: (v) => toggleLinePrefix(v, '- ') },
  { key: 'Mod-Shift-t', run: (v) => toggleLinePrefix(v, '- [ ] ') },
  { key: 'Mod-Shift-q', run: (v) => toggleLinePrefix(v, '> ') },
  { key: 'Alt-ArrowUp', run: moveLineUp },
  { key: 'Alt-ArrowDown', run: moveLineDown },
  { key: 'Mod-Shift-d', run: copyLineDown },
  { key: 'Mod-Shift-k', run: deleteLine },
  { key: 'Mod-l', run: selectLine },
  { key: 'Mod-d', run: selectNextOccurrence },
  { key: 'Enter', run: continueList },
  { key: 'Tab', run: indentMore, shift: indentLess },
];
