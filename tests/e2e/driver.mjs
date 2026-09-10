import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:4444';

export async function startDriver(nativeDriver) {
  const child = spawn('tauri-driver', ['--native-driver', nativeDriver], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  const output = [];
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await wait(250);
    try {
      const answer = await fetch(`${BASE}/status`);
      if (answer.ok) return { child, output };
    } catch {
      continue;
    }
  }

  child.kill();
  throw new Error(`tauri-driver no respondió:\n${output.join('')}`);
}

async function send(method, path, body) {
  const answer = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await answer.text();
  const parsed = text === '' ? {} : JSON.parse(text);
  if (!answer.ok) {
    const message = parsed?.value?.message ?? text;
    throw new Error(`${method} ${path}: ${message}`);
  }
  return parsed.value;
}

export async function openApp(application, args) {
  return send('POST', '/session', {
    capabilities: {
      alwaysMatch: { 'tauri:options': { application, args } },
    },
  }).then((value) => value.sessionId ?? value['sessionId']);
}

export function session(id) {
  const at = (path) => `/session/${id}${path}`;

  return {
    async close() {
      await send('DELETE', at('')).catch(() => undefined);
    },
    async find(selector) {
      const value = await send('POST', at('/element'), {
        using: 'css selector',
        value: selector,
      });
      return Object.values(value)[0];
    },
    async findAll(selector) {
      const value = await send('POST', at('/elements'), {
        using: 'css selector',
        value: selector,
      });
      return value.map((entry) => Object.values(entry)[0]);
    },
    async text(element) {
      return send('GET', at(`/element/${element}/text`));
    },
    async attribute(element, name) {
      return send('GET', at(`/element/${element}/attribute/${name}`));
    },
    async click(element) {
      await send('POST', at(`/element/${element}/click`), {});
    },
    async script(source, args = []) {
      return send('POST', at('/execute/sync'), { script: source, args });
    },
    async drag(from, to) {
      await send('POST', at('/actions'), {
        actions: [
          {
            type: 'pointer',
            id: 'raton',
            parameters: { pointerType: 'mouse' },
            actions: [
              { type: 'pointerMove', duration: 0, x: Math.round(from.x), y: Math.round(from.y) },
              { type: 'pointerDown', button: 0 },
              { type: 'pointerMove', duration: 120, x: Math.round(to.x), y: Math.round(to.y) },
              { type: 'pointerUp', button: 0 },
            ],
          },
        ],
      });
      await send('DELETE', at('/actions')).catch(() => undefined);
    },

    async waitFor(selector, tries = 40) {
      for (let attempt = 0; attempt < tries; attempt += 1) {
        try {
          return await this.find(selector);
        } catch {
          await wait(250);
        }
      }
      throw new Error(`no apareció ${selector}`);
    },
  };
}
