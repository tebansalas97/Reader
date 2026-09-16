import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Config {
  app: { security: { csp: string } };
}

function directives(): Map<string, string[]> {
  const raw = readFileSync(join(process.cwd(), 'src-tauri', 'tauri.conf.json'), 'utf8');
  const config = JSON.parse(raw) as Config;
  const found = new Map<string, string[]>();
  for (const piece of config.app.security.csp.split(';')) {
    const [name, ...sources] = piece.trim().split(/\s+/);
    if (name) found.set(name, sources);
  }
  return found;
}

describe('la politica de contenido', () => {
  it('deja ver las imagenes que estan en el disco', () => {
    const sources = directives().get('img-src') ?? [];
    expect(sources).toContain('asset:');
    expect(sources).toContain('http://asset.localhost');
  });

  it('deja ver las imagenes incrustadas en el propio documento', () => {
    const sources = directives().get('img-src') ?? [];
    expect(sources).toContain('data:');
    expect(sources).toContain('blob:');
  });

  it('deja ver las imagenes de la web, que es lo que traen los README', () => {
    expect(directives().get('img-src') ?? []).toContain('https:');
  });

  it('no deja traerlas por http sin cifrar', () => {
    const sources = directives().get('img-src') ?? [];
    expect(sources).not.toContain('http:');
  });

  it('sigue sin permitir guiones de fuera', () => {
    expect(directives().get('script-src') ?? []).toEqual(["'self'"]);
  });
});
