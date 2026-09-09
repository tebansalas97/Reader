import { describe, expect, it } from 'vitest';
import { setPageMargin } from './page-margin';

describe('setPageMargin', () => {
  it('adds a page rule while it is needed', () => {
    const undo = setPageMargin('0');
    const style = document.head.querySelector('style[data-page-margin="0"]');
    expect(style?.textContent).toContain('@page');
    expect(style?.textContent).toContain('margin: 0');
    undo();
  });

  it('takes the rule away again', () => {
    const undo = setPageMargin('0');
    undo();
    expect(document.head.querySelector('style[data-page-margin="0"]')).toBeNull();
  });

  it('does not mind being undone twice', () => {
    const undo = setPageMargin('0');
    undo();
    expect(() => undo()).not.toThrow();
  });
});
