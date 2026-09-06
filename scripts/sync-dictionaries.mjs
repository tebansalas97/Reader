import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'dictionaries');

const languages = [
  { code: 'es', pkg: 'dictionary-es' },
  { code: 'en', pkg: 'dictionary-en' },
];

await mkdir(target, { recursive: true });

for (const { code, pkg } of languages) {
  const source = join(root, 'node_modules', pkg);
  for (const extension of ['aff', 'dic']) {
    await copyFile(join(source, `index.${extension}`), join(target, `${code}.${extension}`));
  }
  process.stdout.write(`diccionario ${code} listo\n`);
}
