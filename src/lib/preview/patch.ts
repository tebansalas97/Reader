import morphdom from 'morphdom';

function isPreserved(el: Element): boolean {
  return el.hasAttribute('data-rendered');
}

export function patchPreview(root: HTMLElement, html: string): void {
  if (html.length === 0) {
    root.replaceChildren();
    return;
  }
  const next = document.createElement('div');
  next.innerHTML = html;
  morphdom(root, next, {
    childrenOnly: true,
    onBeforeElUpdated(fromEl, toEl) {
      if (fromEl.isEqualNode(toEl)) return false;
      if (isPreserved(fromEl) && !isPreserved(toEl)) return false;
      return true;
    },
  });
}
