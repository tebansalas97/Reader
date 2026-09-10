import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import { openApp, session, startDriver } from './driver.mjs';
import { restorePrefs, seedPrefs } from './prefs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const application = join(root, 'src-tauri', 'target', 'release', 'reader.exe');
const nativeDriver = join(root, 'tools', 'msedgedriver.exe');
const fixture = join(root, 'tests', 'fixtures', 'prueba.pdf');

const results = [];

async function check(name, run) {
  try {
    await run();
    results.push({ name, ok: true });
    process.stdout.write(`  ok  ${name}\n`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error) });
    process.stdout.write(`  NO  ${name}: ${error?.message ?? error}\n`);
  }
}

function missing() {
  if (!existsSync(application)) return `falta el ejecutable: ${application} (npm run build:app)`;
  if (!existsSync(nativeDriver)) {
    return `falta msedgedriver: ${nativeDriver} (ver docs/pruebas-e2e.md)`;
  }
  if (!existsSync(fixture)) return `falta el PDF de prueba: ${fixture} (npm run fixtures)`;
  return null;
}

const problem = missing();
if (problem) {
  process.stdout.write(`${problem}\n`);
  process.exit(2);
}

await seedPrefs({
  restoreSession: true,
  session: [fixture],
  pdfMode: 'continuous',
  autosave: 'off',
  pdfNight: false,
  sidebarPanel: 'pages',
  language: 'es',
});

const driver = await startDriver(nativeDriver);
let app = null;

try {
  const id = await openApp(application, [fixture]).catch((error) => {
    process.stdout.write(`${driver.output.join('')}
`);
    throw error;
  });
  app = session(id);
  await wait(2500);

  await check('recupera el documento de la sesión anterior', async () => {
    const tab = await app.waitFor('.tab .label');
    const title = await app.text(tab);
    if (!title.includes('prueba.pdf')) throw new Error(`la pestaña dice "${title}"`);
  });

  await check('dibuja la primera página', async () => {
    await app.waitFor('.page canvas');
    const width = await app.script('return document.querySelector(".page canvas").width');
    if (!(width > 0)) throw new Error('el lienzo está vacío');
  });

  await check('cuenta las páginas del documento', async () => {
    const value = await app.script(
      'return document.querySelector(".viewer")?.querySelectorAll(".page").length ?? 0',
    );
    if (!(value > 0)) throw new Error('no hay páginas en el visor');
  });

  await check('enciende la herramienta de resaltar', async () => {
    const tool = await app.waitFor('[aria-label="Resaltar"]');
    await app.click(tool);
    const pressed = await app.attribute(tool, 'aria-pressed');
    if (pressed !== 'true') throw new Error(`aria-pressed = ${pressed}`);
    await app.click(tool);
  });

  await check('cambia de modo de lectura', async () => {
    const modes = '[aria-label="Lectura continua"], [aria-label="Una página"], [aria-label="Dos páginas"]';
    const before = await app.attribute(await app.waitFor(modes), 'aria-label');
    await app.click(await app.waitFor(modes));
    await wait(600);
    const after = await app.attribute(await app.waitFor(modes), 'aria-label');
    if (before === after) throw new Error(`sigue en "${after}"`);
  });

  await check('enseña las miniaturas de las páginas', async () => {
    await app.waitFor('.thumbs .thumb');
    const count = await app.script('return document.querySelectorAll(".thumbs .thumb").length');
    if (count !== 12) throw new Error(`hay ${count} miniaturas`);
  });

  await check('lleva la barra de estado la página que se lee', async () => {
    const bar = await app.waitFor('.statusbar');
    const text = await app.text(bar);
    if (!text.includes('1')) throw new Error(`la barra dice "${text}"`);
  });
  await check('dibuja una anotación arrastrando sobre la página', async () => {
    await app.click(await app.waitFor('[aria-label="Dibujar"]'));
    const box = await app.script(
      'const r = document.querySelector(".viewer .page").getBoundingClientRect();' +
        'return { x: r.left, y: r.top, width: r.width, height: r.height };',
    );
    await app.drag(
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 },
      { x: box.x + box.width * 0.6, y: box.y + box.height * 0.4 },
    );
    await wait(600);
    const strokes = await app.script('return document.querySelectorAll(".layer polyline").length');
    if (!(strokes > 0)) throw new Error('no quedó ningún trazo');
  });

  await check('la anotación nueva sale en el panel de notas', async () => {
    await app.click(await app.waitFor('[aria-label="Notas"]'));
    const marks = await app.script('return document.querySelectorAll(".marks .mark, .mark").length');
    if (!(marks > 0)) throw new Error('el panel de notas está vacío');
  });

} finally {
  await app?.close();
  driver.child.kill();
  await restorePrefs();
}

const failed = results.filter((entry) => !entry.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} pruebas de extremo a extremo\n`);
process.exit(failed.length === 0 ? 0 : 1);
