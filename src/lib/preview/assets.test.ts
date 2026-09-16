import { describe, expect, it, vi } from 'vitest';
import { grantAssetDirs, missingDirs, retryBroken } from './assets';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

function loaded(img: HTMLImageElement, width: number): void {
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'complete', { value: true, configurable: true });
}

describe('missingDirs', () => {
  it('se queda con las carpetas que aun no tienen permiso', () => {
    expect(missingDirs(['C:/a', 'C:/b'], new Set(['c:/a']))).toEqual(['C:/b']);
  });

  it('no repite una carpeta que sale dos veces', () => {
    expect(missingDirs(['C:/a', 'C:/a'], new Set())).toEqual(['C:/a']);
  });

  it('no distingue mayusculas, que en Windows son la misma carpeta', () => {
    expect(missingDirs(['C:/Docs/img'], new Set(['c:/docs/img']))).toEqual([]);
  });

  it('deja fuera lo vacio', () => {
    expect(missingDirs(['', 'C:/a'], new Set())).toEqual(['C:/a']);
  });
});

describe('grantAssetDirs', () => {
  it('pide permiso una vez por carpeta nueva', async () => {
    const allow = vi.fn(async () => undefined);
    const known = new Set<string>();
    await grantAssetDirs(['C:/uno', 'C:/dos'], allow, known);
    expect(allow).toHaveBeenCalledTimes(2);
  });

  it('no vuelve a pedir lo que ya concedio', async () => {
    const allow = vi.fn(async () => undefined);
    const known = new Set<string>();
    await grantAssetDirs(['C:/uno'], allow, known);
    await grantAssetDirs(['C:/uno'], allow, known);
    expect(allow).toHaveBeenCalledTimes(1);
  });

  it('avisa de si hubo algun permiso nuevo', async () => {
    const allow = vi.fn(async () => undefined);
    const known = new Set<string>();
    expect(await grantAssetDirs(['C:/uno'], allow, known)).toBe(true);
    expect(await grantAssetDirs(['C:/uno'], allow, known)).toBe(false);
    expect(await grantAssetDirs([], allow, known)).toBe(false);
  });

  it('no da por concedida una carpeta que fallo', async () => {
    const allow = vi.fn(async () => {
      throw new Error('denegado');
    });
    const known = new Set<string>();
    await grantAssetDirs(['C:/uno'], allow, known);
    await grantAssetDirs(['C:/uno'], allow, known);
    expect(allow).toHaveBeenCalledTimes(2);
  });
});

describe('retryBroken', () => {
  it('vuelve a pedir la imagen que no llego a cargar', () => {
    const el = root('<img src="http://asset.localhost/C%3A%2Fa.png">');
    const img = el.querySelector('img') as HTMLImageElement;
    loaded(img, 0);
    expect(retryBroken(el)).toBe(1);
  });

  it('deja en paz la que ya se ve', () => {
    const el = root('<img src="http://asset.localhost/C%3A%2Fa.png">');
    loaded(el.querySelector('img') as HTMLImageElement, 64);
    expect(retryBroken(el)).toBe(0);
  });

  it('no toca las que no vienen del disco', () => {
    const el = root('<img src="https://x.com/a.png"><img src="data:image/png;base64,AA">');
    for (const img of Array.from(el.querySelectorAll('img'))) loaded(img, 0);
    expect(retryBroken(el)).toBe(0);
  });

  it('conserva la direccion al reintentar', () => {
    const el = root('<img src="http://asset.localhost/C%3A%2Fa.png">');
    const img = el.querySelector('img') as HTMLImageElement;
    loaded(img, 0);
    retryBroken(el);
    expect(img.getAttribute('src')).toBe('http://asset.localhost/C%3A%2Fa.png');
  });
});
