import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'pdfjs-dist');
const target = join(root, 'public', 'pdf');

await mkdir(target, { recursive: true });
await copyFile(join(source, 'build', 'pdf.worker.min.mjs'), join(target, 'pdf.worker.min.mjs'));
process.stdout.write('worker de pdf.js listo\n');
