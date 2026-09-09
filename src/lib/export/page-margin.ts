export function setPageMargin(margin: string): () => void {
  const style = document.createElement('style');
  style.dataset.pageMargin = margin;
  style.textContent = `@page { margin: ${margin}; }`;
  document.head.append(style);
  return () => style.remove();
}
