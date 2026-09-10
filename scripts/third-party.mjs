import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CHOSEN = {
  'dictionary-es': {
    license: 'MPL-1.1',
    note: 'Se ofrece con GPL-3.0, LGPL-3.0 o MPL-1.1. Reader elige MPL-1.1.',
  },
  dompurify: { license: 'Apache-2.0', note: 'Se ofrece con MPL-2.0 o Apache-2.0.' },
};

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'COPYING'];

const PATTERNS = [
  [/MIT License/i, 'MIT'],
  [/Apache License/i, 'Apache-2.0'],
  [/BSD 3-Clause/i, 'BSD-3-Clause'],
  [/BSD 2-Clause/i, 'BSD-2-Clause'],
  [/ISC License/i, 'ISC'],
  [/Mozilla Public License/i, 'MPL-2.0'],
];

async function licenseFromFile(base) {
  for (const name of LICENSE_FILES) {
    const text = await readFile(join(base, name), 'utf8').catch(() => null);
    if (!text) continue;
    for (const [pattern, license] of PATTERNS) {
      if (pattern.test(text.slice(0, 400))) return `${license} (según su archivo de licencia)`;
    }
    return 'ver su archivo de licencia';
  }
  return 'sin declarar';
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => entry.type ?? entry).join(' o ');
  if (value && typeof value === 'object') return value.type ?? '?';
  return 'sin declarar';
}

async function packagesIn(base, scope = '') {
  const names = await readdir(base, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const entry of names) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('@')) {
      found.push(...(await packagesIn(join(base, entry.name), `${entry.name}/`)));
      continue;
    }
    if (entry.name.startsWith('.')) continue;
    try {
      const manifest = JSON.parse(
        await readFile(join(base, entry.name, 'package.json'), 'utf8'),
      );
      if (!manifest.name) continue;
      const declared = manifest.license ?? manifest.licenses;
      found.push({
        name: `${scope}${entry.name}`,
        version: manifest.version ?? '?',
        license: declared ? textOf(declared) : await licenseFromFile(join(base, entry.name)),
      });
    } catch {
      continue;
    }
  }
  return found;
}

function rustPackages() {
  try {
    const raw = execFileSync('cargo', ['metadata', '--format-version', '1'], {
      cwd: join(root, 'src-tauri'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const meta = JSON.parse(raw);
    return meta.packages
      .filter((entry) => entry.name !== 'reader')
      .map((entry) => ({
        name: entry.name,
        version: entry.version,
        license: entry.license ?? 'sin declarar',
      }));
  } catch {
    return [];
  }
}

function tally(list) {
  const counts = new Map();
  for (const entry of list) counts.set(entry.license, (counts.get(entry.license) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function table(list) {
  const rows = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return rows
    .map((entry) => {
      const chosen = CHOSEN[entry.name];
      const license = chosen ? `**${chosen.license}**` : entry.license;
      const note = chosen ? ` — ${chosen.note}` : '';
      return `| \`${entry.name}\` | ${entry.version} | ${license}${note} |`;
    })
    .join('\n');
}

const web = await packagesIn(join(root, 'node_modules'));
const rust = rustPackages();

const out = `# Terceros

Este archivo lo genera \`npm run licenses\`. No se edita a mano.

Reader se distribuye con la licencia Apache 2.0. Los componentes de abajo son de
otros y llevan la suya. Todas son permisivas: ninguna obliga a publicar Reader con
otra licencia.

La lista incluye todo lo que hay instalado, tanto lo que viaja dentro del instalador
como las herramientas que solo se usan para compilar y que no se distribuyen.

Dos dependencias se ofrecen con varias licencias a elegir, y aquí queda escrito
cuál elige Reader:

${Object.entries(CHOSEN)
  .map(([name, chosen]) => `- \`${name}\`: **${chosen.license}**. ${chosen.note}`)
  .join('\n')}

## Resumen

| Origen | Paquetes |
| --- | --- |
| JavaScript | ${web.length} |
| Rust | ${rust.length} |

### Licencias en el lado JavaScript

${tally(web)
  .map(([license, count]) => `- ${count} × ${license}`)
  .join('\n')}

### Licencias en el lado Rust

${tally(rust)
  .map(([license, count]) => `- ${count} × ${license}`)
  .join('\n')}

## JavaScript

| Paquete | Versión | Licencia |
| --- | --- | --- |
${table(web)}

## Rust

| Caja | Versión | Licencia |
| --- | --- | --- |
${table(rust)}
`;

await writeFile(join(root, 'THIRD-PARTY.md'), out);
process.stdout.write(`THIRD-PARTY.md: ${web.length} de JavaScript y ${rust.length} de Rust\n`);
