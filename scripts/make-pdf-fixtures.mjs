import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'fixtures');

const PAGES = 12;
const LINES = 26;

async function plain() {
  const document = await PDFDocument.create();
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const font = await document.embedFont(StandardFonts.Helvetica);

  for (let number = 1; number <= PAGES; number += 1) {
    const page = document.addPage([612, 792]);
    page.drawText('Reader — prueba de PDF', { x: 60, y: 760, size: 22, font: bold });
    page.drawText(`Pagina ${number} de ${PAGES}`, {
      x: 60,
      y: 720,
      size: 13,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    for (let line = 1; line <= LINES; line += 1) {
      const y = 670 - (line - 1) * 26;
      if (y < 60) break;
      page.drawText(
        `Linea ${line} de la pagina ${number}. Texto de relleno para probar el visor, el scroll y el zoom.`,
        { x: 60, y, size: 11, font },
      );
    }
  }

  return document.save();
}

const bytes = await plain();
await mkdir(out, { recursive: true });
await writeFile(join(out, 'prueba.pdf'), bytes);
process.stdout.write(`fixture en ${out}\n`);
