import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const document = await PDFDocument.create();
const font = await document.embedFont(StandardFonts.Helvetica);

const widths = [];
for (let code = 0; code < 256; code += 1) {
  let width = 0;
  try {
    width = Math.round(font.widthOfTextAtSize(String.fromCharCode(code), 1000));
  } catch {
    width = 0;
  }
  widths.push(Number.isFinite(width) ? width : 0);
}

const rows = [];
for (let index = 0; index < widths.length; index += 16) {
  rows.push('  ' + widths.slice(index, index + 16).join(', ') + ',');
}

const out = `export const HELVETICA_WIDTHS: number[] = [
${rows.join('\n')}
];
`;

await writeFile(join(root, 'src/lib/pdf/annotations/helvetica.ts'), out);
process.stdout.write('helvetica.ts escrito\n');
