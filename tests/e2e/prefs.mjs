import { copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const folder = join(process.env.APPDATA ?? '', 'dev.esteban.reader');
const file = join(folder, 'prefs.json');
const backup = join(folder, 'prefs.e2e-backup.json');

export async function seedPrefs(patch) {
  if (existsSync(backup)) await restorePrefs();
  if (existsSync(file)) await copyFile(file, backup);

  const current = existsSync(file)
    ? JSON.parse(await readFile(file, 'utf8').catch(() => '{}'))
    : {};

  await writeFile(file, JSON.stringify({ ...current, ...patch }, null, 2));
}

export async function restorePrefs() {
  if (!existsSync(backup)) return;
  await copyFile(backup, file);
  await rm(backup, { force: true });
}
