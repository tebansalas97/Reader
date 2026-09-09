import { afterEach } from 'vitest';
import { installGraphicsStubs } from './dom-graphics';

installGraphicsStubs();

const noRects = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as unknown as DOMRectList;

const emptyRect: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({}),
};

if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects = () => noRects;
  Range.prototype.getBoundingClientRect = () => emptyRect;
}

if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

afterEach(() => {
  document.body.innerHTML = '';
});
