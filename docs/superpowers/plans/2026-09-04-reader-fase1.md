# Reader Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Reader desktop app shell on Tauri 2 with a complete Markdown reader/editor: split view, reading mode, live preview, file tree, outline, save/autosave, external-change detection, export, and a Windows NSIS installer.

**Architecture:** The WebView (Svelte 5 + CodeMirror 6 + markdown-it) owns document state and all rendering. Rust exposes a small set of stateless filesystem, watcher and preferences commands. Preview updates patch the DOM incrementally (morphdom) and heavy renderers (highlight.js, KaTeX, Mermaid) load on demand.

**Tech Stack:** Tauri 2.11, Rust 1.98, Svelte 5.57, Vite 8, TypeScript 5.9, Vitest 5, jsdom, CodeMirror 6, markdown-it 15, morphdom, DOMPurify, highlight.js, KaTeX, Mermaid, notify (Rust).

**Spec:** `docs/superpowers/specs/2026-09-04-reader-fase1-design.md`

## Global Constraints

- No comments of any kind in code files (user's global rule). No block, line, docstring or file-header comments in `.ts`, `.svelte`, `.rs`, `.css`, `.json`, `.ps1`. Explanations go in docs or commit messages.
- UI language: Spanish by default, English available, strings only in `src/lib/i18n.ts`.
- Performance budgets from spec §3: first paint < 400 ms, idle RAM < 70 MB, installer < 15 MB, 5 MB file editable < 800 ms, key→preview < 32 ms for docs < 200 KB.
- KaTeX, Mermaid and highlight.js are never in the initial bundle: dynamic `import()` only.
- Preview never assigns `innerHTML` for the whole document; always morphdom.
- All HTML from markdown-it goes through DOMPurify before touching the DOM.
- Rust commands never `unwrap()` on user input; every command returns `Result<T, AppError>`.
- File writes are atomic (temp file + rename) and preserve the original line ending.
- Window uses `decorations: false` with a custom title bar.
- CSP: `default-src 'self'; img-src 'self' asset: http://asset.localhost data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:`.
- Commit after every task with the trailer:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01NMNsE4un1aeGbSPEJYNqdd
  ```
- Rust toolchain lives at `%USERPROFILE%\.cargo\bin`; in Bash prepend `export PATH="$HOME/.cargo/bin:$PATH"`.
- Package manager: npm.

## Pinned versions

npm:

```
@tauri-apps/cli 2.11.4, @tauri-apps/api 2.11.1, @tauri-apps/plugin-dialog 2.7.3,
@tauri-apps/plugin-window-state 2.4.1, @tauri-apps/plugin-cli 2.4.1, @tauri-apps/plugin-opener 2.5.x,
svelte 5.57.0, @sveltejs/vite-plugin-svelte 7.3.0, vite 8.2.2, typescript 5.9.3, svelte-check 4.7.6,
vitest 5.0.0, jsdom 30.0.1, @testing-library/svelte 5.4.2,
codemirror 6.0.2, @codemirror/lang-markdown 6.5.2, @codemirror/language-data 6.5.2,
markdown-it 15.0.1, @types/markdown-it 14.2.0, markdown-it-task-lists 2.1.1, markdown-it-footnote 4.0.0,
markdown-it-anchor 9.2.1, @vscode/markdown-it-katex 1.1.2, katex 0.18.5, mermaid 11.17.2,
highlight.js 11.12.0, morphdom 2.7.8, dompurify 3.4.14
```

Cargo:

```
tauri 2.11 (features: devtools off in release), tauri-build 2.6, tauri-plugin-dialog 2.7,
tauri-plugin-window-state 2.4, tauri-plugin-cli 2.4, tauri-plugin-single-instance 2.4,
tauri-plugin-opener 2.5, notify 8, notify-debouncer-full 0.5, serde 1, serde_json 1,
thiserror 2, dirs 6, tempfile 3 (dev)
```

## File structure

See spec §4.2. Responsibilities in one line each:

| File | Responsibility |
|---|---|
| `src-tauri/src/error.rs` | `AppError` enum, `From<io::Error>`, serializes to `{kind, message, path}` |
| `src-tauri/src/commands/fs.rs` | `read_text`, `write_text`, `exists`, `list_dir`, line-ending detection |
| `src-tauri/src/commands/watcher.rs` | `watch`, `unwatch`, emits `fs:changed` |
| `src-tauri/src/commands/store.rs` | JSON file store used by prefs and recent |
| `src-tauri/src/commands/prefs.rs` | `get_prefs`, `set_prefs` |
| `src-tauri/src/commands/recent.rs` | `get_recent`, `push_recent`, `clear_recent` |
| `src-tauri/src/commands/shell.rs` | `open_external` with scheme allowlist |
| `src-tauri/src/lib.rs` | builder, plugins, single-instance handler, cli args → `open-paths` event |
| `src/lib/fs/api.ts` | typed `invoke` wrappers, `ReaderError` |
| `src/lib/fs/paths.ts` | `dirname`, `basename`, `join`, `isMarkdown`, `titleFromPath` |
| `src/lib/fs/events.ts` | `onFsChanged`, `onOpenPaths` listeners |
| `src/lib/state/prefs.svelte.ts` | `Prefs` type, defaults, load/save with debounce |
| `src/lib/state/documents.svelte.ts` | documents list, active id, open/close/save, dirty |
| `src/lib/state/ui.svelte.ts` | view mode, sidebar, zen, split ratio |
| `src/lib/state/recent.svelte.ts` | recent list mirror |
| `src/lib/state/toasts.svelte.ts` | notifications |
| `src/lib/editor/*` | CodeMirror factory, commands, keymap, theme |
| `src/lib/preview/*` | markdown-it pipeline, render, patch, lazy, scroll-sync, outline, links |
| `src/lib/export/*` | HTML export, print |
| `src/lib/ui/*.svelte` | components |
| `src/lib/shortcuts.ts` | global keydown dispatcher |
| `src/lib/i18n.ts` | strings |
| `src/lib/stats.ts` | word/char count, reading time |

---

### Task 1: Scaffold the Tauri + Svelte project with test infrastructure

**Files:**
- Create: `package.json`, `vite.config.ts`, `svelte.config.js`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/app.css`, `src/vite-env.d.ts`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/icons/*`
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: a running `npm run tauri dev` window showing "Reader"; `npm test` runs Vitest; `cargo test` runs in `src-tauri`.

- [ ] **Step 1: Initialise package.json and install frontend dependencies**

```bash
cd "C:/Users/Esteban/Documents/Reader"
npm init -y >/dev/null
npm pkg set name=reader version=0.1.0 private=true type=module
npm pkg set scripts.dev="vite" scripts.build="vite build" scripts.preview="vite preview" scripts.check="svelte-check --tsconfig ./tsconfig.json" scripts.test="vitest run" scripts.test:watch="vitest" scripts.tauri="tauri"
npm i -D @tauri-apps/cli@2.11.4 svelte@5.57.0 @sveltejs/vite-plugin-svelte@7.3.0 vite@8.2.2 typescript@5.9.3 svelte-check@4.7.6 vitest@5.0.0 jsdom@30.0.1 @testing-library/svelte@5.4.2 @types/node@22
npm i @tauri-apps/api@2.11.1 @tauri-apps/plugin-dialog@2.7.3 @tauri-apps/plugin-window-state@2.4.1 @tauri-apps/plugin-cli@2.4.1 @tauri-apps/plugin-opener
```

- [ ] **Step 2: Write Vite, Svelte and TS config**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    target: 'chrome120',
    minify: 'esbuild',
    sourcemap: false,
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: ['codemirror', '@codemirror/lang-markdown', '@codemirror/language-data'],
          markdown: ['markdown-it', 'markdown-it-task-lists', 'markdown-it-footnote', 'markdown-it-anchor', 'dompurify', 'morphdom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
```

`svelte.config.js`:
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
};
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "allowJs": true,
    "checkJs": false,
    "types": ["vite/client", "node"],
    "baseUrl": ".",
    "paths": { "$lib/*": ["src/lib/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "vite.config.ts"]
}
```

Add `resolve: { alias: { $lib: '/src/lib' } }` to the Vite config so `$lib/...` imports work in both Vite and Vitest (alias path `fileURLToPath(new URL('./src/lib', import.meta.url))`).

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reader</title>
    <link rel="stylesheet" href="/src/app.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

`src/vite-env.d.ts`:
```ts
/// <reference types="svelte" />
/// <reference types="vite/client" />
```

`src/App.svelte` (placeholder to be replaced in Task 13):
```svelte
<main>Reader</main>
```

`src/app.css` gets the full token set in Task 7; for now:
```css
:root { color-scheme: light dark; }
html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }
```

- [ ] **Step 3: Write the smoke test and run it**

`src/lib/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('test runner', () => {
  it('runs in jsdom', () => {
    expect(typeof document).toBe('object');
  });
});
```

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 4: Create the Rust crate**

`src-tauri/Cargo.toml`:
```toml
[package]
name = "reader"
version = "0.1.0"
edition = "2021"
rust-version = "1.80"

[lib]
name = "reader_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.6", features = [] }

[dependencies]
tauri = { version = "2.11", features = ["protocol-asset"] }
tauri-plugin-dialog = "2.7"
tauri-plugin-window-state = "2.4"
tauri-plugin-cli = "2.4"
tauri-plugin-single-instance = "2.4"
tauri-plugin-opener = "2.5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
dirs = "6"
notify = "8"
notify-debouncer-full = "0.5"

[dev-dependencies]
tempfile = "3"

[profile.release]
codegen-units = 1
lto = true
opt-level = "s"
panic = "abort"
strip = true
```

`src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    reader_lib::run()
}
```

`src-tauri/src/lib.rs` (minimal; grows in Tasks 2-5):
```rust
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Reader",
  "version": "0.1.0",
  "identifier": "dev.esteban.reader",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Reader",
        "width": 1200,
        "height": 800,
        "minWidth": 640,
        "minHeight": 400,
        "decorations": false,
        "transparent": false,
        "visible": false,
        "dragDropEnabled": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: http://asset.localhost data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'",
      "assetProtocol": { "enable": true, "scope": [] }
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.ico"],
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper" },
      "nsis": { "installMode": "currentUser", "languages": ["Spanish", "English"] }
    },
    "fileAssociations": [
      { "ext": ["md", "markdown"], "name": "Markdown", "description": "Documento Markdown", "role": "Editor" }
    ]
  },
  "plugins": {
    "cli": { "args": [{ "name": "paths", "index": 1, "takesValue": true, "multiple": true }] }
  }
}
```

The window starts `visible: false` and is shown from the frontend after first render (Task 13) to avoid a white flash.

`src-tauri/capabilities/default.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Main window capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-is-maximized",
    "core:window:allow-start-dragging",
    "core:window:allow-show",
    "core:window:allow-set-title",
    "core:window:allow-set-theme",
    "core:window:allow-theme",
    "core:event:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-ask",
    "dialog:allow-message",
    "window-state:default",
    "cli:default",
    "opener:allow-open-url"
  ]
}
```

Icons: generate with `npx tauri icon` from a 1024×1024 PNG. Create a simple placeholder PNG with Python Pillow (a rounded square with the letter R) at `src-tauri/icons/source.png`, then run `npx tauri icon src-tauri/icons/source.png`.

- [ ] **Step 5: Build and run the Rust side once**

Run: `cd src-tauri && cargo build 2>&1 | tail -3`
Expected: `Finished` line, no errors. First build takes several minutes.

Run: `cd src-tauri && cargo test 2>&1 | tail -3`
Expected: `test result: ok. 0 passed`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri 2 + Svelte 5 + Vitest project"
```

---

### Task 2: Rust error type and text file commands

**Files:**
- Create: `src-tauri/src/error.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/fs.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces:
  - `AppError { kind: ErrorKind, message: String, path: Option<String> }` serialized as `{ "kind": "NotFound" | "PermissionDenied" | "NotUtf8" | "Io" | "InvalidPath", "message": string, "path"?: string }`
  - `#[tauri::command] async fn read_text(path: String) -> Result<TextFile, AppError>` where `TextFile { text: String, modified_ms: u64, line_ending: "lf" | "crlf" }`
  - `#[tauri::command] async fn write_text(path: String, text: String, line_ending: String) -> Result<u64, AppError>` returning new `modified_ms`
  - `#[tauri::command] async fn exists(path: String) -> bool`

- [ ] **Step 1: Write error.rs**

```rust
use serde::Serialize;
use std::io;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum ErrorKind {
    NotFound,
    PermissionDenied,
    NotUtf8,
    Io,
    InvalidPath,
}

#[derive(Debug, Serialize, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl AppError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self { kind, message: message.into(), path: None }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn from_io(err: io::Error, path: &str) -> Self {
        let kind = match err.kind() {
            io::ErrorKind::NotFound => ErrorKind::NotFound,
            io::ErrorKind::PermissionDenied => ErrorKind::PermissionDenied,
            _ => ErrorKind::Io,
        };
        Self::new(kind, err.to_string()).with_path(path)
    }
}

pub type AppResult<T> = Result<T, AppError>;
```

- [ ] **Step 2: Write the failing tests inside fs.rs**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn reads_lf_file_and_reports_lf() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, "hola\nmundo\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "hola\nmundo\n");
        assert_eq!(f.line_ending, LineEnding::Lf);
        assert!(f.modified_ms > 0);
    }

    #[test]
    fn reads_crlf_file_normalises_and_reports_crlf() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, "hola\r\nmundo\r\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "hola\nmundo\n");
        assert_eq!(f.line_ending, LineEnding::Crlf);
    }

    #[test]
    fn strips_utf8_bom() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, b"\xEF\xBB\xBF# T\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "# T\n");
    }

    #[test]
    fn rejects_non_utf8() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, [0xff, 0xfe, 0x00, 0x41]).unwrap();
        let e = read_text_sync(p.to_str().unwrap()).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotUtf8);
    }

    #[test]
    fn missing_file_is_not_found() {
        let dir = tmp();
        let p = dir.path().join("nope.md");
        let e = read_text_sync(p.to_str().unwrap()).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotFound);
        assert_eq!(e.path.as_deref(), Some(p.to_str().unwrap()));
    }

    #[test]
    fn writes_with_crlf_when_requested_and_leaves_no_temp() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        write_text_sync(p.to_str().unwrap(), "a\nb", LineEnding::Crlf).unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"a\r\nb");
        let names: Vec<_> = fs::read_dir(dir.path()).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(names.len(), 1);
    }

    #[test]
    fn write_returns_modified_ms_matching_read() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        let m = write_text_sync(p.to_str().unwrap(), "x", LineEnding::Lf).unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(m, f.modified_ms);
    }

    #[test]
    fn empty_path_is_invalid() {
        let e = read_text_sync("").unwrap_err();
        assert_eq!(e.kind, ErrorKind::InvalidPath);
    }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: compile error, `read_text_sync` not found.

- [ ] **Step 4: Implement fs.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
}

#[derive(Debug, Serialize)]
pub struct TextFile {
    pub text: String,
    pub modified_ms: u64,
    pub line_ending: LineEnding,
}

fn validate(path: &str) -> AppResult<PathBuf> {
    if path.trim().is_empty() {
        return Err(AppError::new(ErrorKind::InvalidPath, "Ruta vacía"));
    }
    Ok(PathBuf::from(path))
}

fn modified_ms_of(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn read_text_sync(path: &str) -> AppResult<TextFile> {
    let p = validate(path)?;
    let bytes = fs::read(&p).map_err(|e| AppError::from_io(e, path))?;
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF][..]).unwrap_or(&bytes);
    let raw = std::str::from_utf8(bytes)
        .map_err(|_| AppError::new(ErrorKind::NotUtf8, "El archivo no es UTF-8").with_path(path))?;
    let line_ending = if raw.contains("\r\n") { LineEnding::Crlf } else { LineEnding::Lf };
    let text = if line_ending == LineEnding::Crlf { raw.replace("\r\n", "\n") } else { raw.to_owned() };
    Ok(TextFile { text, modified_ms: modified_ms_of(&p), line_ending })
}

pub fn write_text_sync(path: &str, text: &str, line_ending: LineEnding) -> AppResult<u64> {
    let p = validate(path)?;
    let data = match line_ending {
        LineEnding::Lf => text.to_owned(),
        LineEnding::Crlf => text.replace('\n', "\r\n"),
    };
    let dir = p.parent().filter(|d| !d.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let mut tmp = tempfile::Builder::new()
        .prefix(".reader-")
        .suffix(".tmp")
        .tempfile_in(dir)
        .map_err(|e| AppError::from_io(e, path))?;
    tmp.write_all(data.as_bytes()).map_err(|e| AppError::from_io(e, path))?;
    tmp.flush().map_err(|e| AppError::from_io(e, path))?;
    tmp.persist(&p).map_err(|e| AppError::from_io(e.error, path))?;
    Ok(modified_ms_of(&p))
}

#[tauri::command]
pub async fn read_text(path: String) -> AppResult<TextFile> {
    tauri::async_runtime::spawn_blocking(move || read_text_sync(&path))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub async fn write_text(path: String, text: String, line_ending: LineEnding) -> AppResult<u64> {
    tauri::async_runtime::spawn_blocking(move || write_text_sync(&path, &text, line_ending))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub async fn exists(path: String) -> bool {
    Path::new(&path).exists()
}
```

`tempfile` moves from dev-dependencies to dependencies in `Cargo.toml`.

`src-tauri/src/commands/mod.rs`:
```rust
pub mod fs;
```

`src-tauri/src/lib.rs`:
```rust
mod commands;
mod error;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text,
            commands::fs::write_text,
            commands::fs::exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Run tests**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: `test result: ok. 8 passed`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri
git commit -m "feat(rust): AppError and atomic text read/write commands"
```

---

### Task 3: Directory listing command

**Files:**
- Create: `src-tauri/src/commands/dir.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `AppError`, `AppResult`, `ErrorKind` from Task 2.
- Produces: `#[tauri::command] async fn list_dir(path: String, depth: u8) -> Result<Vec<Entry>, AppError>` where `Entry { name: String, path: String, is_dir: bool, children: Option<Vec<Entry>> }`. Serde does not rename fields, so the frontend reads `is_dir`.

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn fixture() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("b.md"), "").unwrap();
        fs::write(d.path().join("a.md"), "").unwrap();
        fs::write(d.path().join("notes.txt"), "").unwrap();
        fs::write(d.path().join("photo.png"), "").unwrap();
        fs::create_dir(d.path().join("sub")).unwrap();
        fs::write(d.path().join("sub").join("c.markdown"), "").unwrap();
        fs::create_dir(d.path().join("node_modules")).unwrap();
        d
    }

    #[test]
    fn lists_markdown_and_text_only() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let names: Vec<&str> = e.iter().map(|x| x.name.as_str()).collect();
        assert!(names.contains(&"a.md"));
        assert!(names.contains(&"notes.txt"));
        assert!(!names.contains(&"photo.png"));
    }

    #[test]
    fn directories_come_first_then_alphabetical() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let names: Vec<&str> = e.iter().map(|x| x.name.as_str()).collect();
        assert_eq!(names, vec!["sub", "a.md", "b.md", "notes.txt"]);
    }

    #[test]
    fn skips_ignored_directories() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 2).unwrap();
        assert!(e.iter().all(|x| x.name != "node_modules"));
    }

    #[test]
    fn depth_one_leaves_children_none() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let sub = e.iter().find(|x| x.name == "sub").unwrap();
        assert!(sub.children.is_none());
    }

    #[test]
    fn depth_two_fills_children() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 2).unwrap();
        let sub = e.iter().find(|x| x.name == "sub").unwrap();
        assert_eq!(sub.children.as_ref().unwrap()[0].name, "c.markdown");
    }

    #[test]
    fn depth_is_capped() {
        let d = fixture();
        assert!(list_dir_sync(d.path().to_str().unwrap(), 200).is_ok());
    }

    #[test]
    fn missing_directory_is_not_found() {
        let e = list_dir_sync("Z:/definitely/not/here", 1).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotFound);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src-tauri && cargo test list_dir 2>&1 | tail -5`
Expected: compile error, `list_dir_sync` not found.

- [ ] **Step 3: Implement dir.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use serde::Serialize;
use std::fs;
use std::path::Path;

const IGNORED: [&str; 6] = ["node_modules", ".git", "target", "dist", ".svelte-kit", "$RECYCLE.BIN"];
const EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
const MAX_DEPTH: u8 = 4;
const MAX_ENTRIES: usize = 2000;

#[derive(Debug, Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<Entry>>,
}

fn is_visible_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.') || IGNORED.contains(&name)
}

pub fn list_dir_sync(path: &str, depth: u8) -> AppResult<Vec<Entry>> {
    walk(Path::new(path), depth.clamp(1, MAX_DEPTH))
}

fn walk(dir: &Path, depth: u8) -> AppResult<Vec<Entry>> {
    let read = fs::read_dir(dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))?;
    let mut dirs: Vec<Entry> = Vec::new();
    let mut files: Vec<Entry> = Vec::new();
    for item in read.flatten() {
        if dirs.len() + files.len() >= MAX_ENTRIES {
            break;
        }
        let name = item.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        let p = item.path();
        let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            let children = if depth > 1 { walk(&p, depth - 1).ok() } else { None };
            dirs.push(Entry { name, path: p.to_string_lossy().into_owned(), is_dir: true, children });
        } else if is_visible_file(&p) {
            files.push(Entry { name, path: p.to_string_lossy().into_owned(), is_dir: false, children: None });
        }
    }
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
pub async fn list_dir(path: String, depth: u8) -> AppResult<Vec<Entry>> {
    tauri::async_runtime::spawn_blocking(move || list_dir_sync(&path, depth))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}
```

Add `pub mod dir;` to `commands/mod.rs` and `commands::dir::list_dir` to the invoke handler.

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: all tests pass, 7 new ones included.

- [ ] **Step 5: Commit**

```bash
git add src-tauri
git commit -m "feat(rust): list_dir command with filtering and depth limit"
```

---

### Task 4: Filesystem watcher

**Files:**
- Create: `src-tauri/src/commands/watcher.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `AppError`, `AppResult`, `ErrorKind` from Task 2.
- Produces:
  - `#[tauri::command] fn watch(app: AppHandle, state: State<WatcherState>, path: String) -> Result<(), AppError>`
  - `#[tauri::command] fn unwatch(state: State<WatcherState>, path: String) -> Result<(), AppError>`
  - Event `fs:changed` with payload `{ path: string, kind: "modified" | "removed" }`
  - `WatcherState::default()` to be registered with `.manage(...)`

- [ ] **Step 1: Write the failing tests**

The watcher's IO is not deterministic enough for a unit test, so the tests cover the path registry, which is where the bugs live.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_tracks_and_untracks() {
        let r = Registry::default();
        assert!(r.add("C:/a.md".into()));
        assert!(!r.add("C:/a.md".into()));
        assert!(r.contains("C:/a.md"));
        assert!(r.remove("C:/a.md"));
        assert!(!r.contains("C:/a.md"));
        assert!(!r.remove("C:/a.md"));
    }

    #[test]
    fn registry_normalises_separators() {
        let r = Registry::default();
        r.add("C:\\docs\\a.md".into());
        assert!(r.contains("C:/docs/a.md"));
    }

    #[test]
    fn registry_is_case_insensitive_on_windows_paths() {
        let r = Registry::default();
        r.add("C:/Docs/A.md".into());
        assert!(r.contains("c:/docs/a.md"));
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src-tauri && cargo test registry 2>&1 | tail -5`
Expected: compile error, `Registry` not found.

- [ ] **Step 3: Implement watcher.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize)]
pub struct FsChanged {
    pub path: String,
    pub kind: &'static str,
}

pub fn normalise(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

#[derive(Default)]
pub struct Registry {
    paths: Mutex<HashSet<String>>,
}

impl Registry {
    pub fn add(&self, path: String) -> bool {
        self.paths.lock().unwrap().insert(normalise(&path))
    }

    pub fn remove(&self, path: &str) -> bool {
        self.paths.lock().unwrap().remove(&normalise(path))
    }

    pub fn contains(&self, path: &str) -> bool {
        self.paths.lock().unwrap().contains(&normalise(path))
    }
}

pub struct WatcherState {
    pub registry: Registry,
    debouncer: Mutex<Option<Debouncer<notify::RecommendedWatcher, RecommendedCache>>>,
    dirs: Mutex<HashSet<String>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            registry: Registry::default(),
            debouncer: Mutex::new(None),
            dirs: Mutex::new(HashSet::new()),
        }
    }
}

fn kind_of(event: &DebouncedEvent) -> &'static str {
    if event.kind.is_remove() {
        "removed"
    } else {
        "modified"
    }
}

fn ensure_debouncer(app: &AppHandle, state: &WatcherState) -> AppResult<()> {
    let mut guard = state.debouncer.lock().unwrap();
    if guard.is_some() {
        return Ok(());
    }
    let handle = app.clone();
    let debouncer = new_debouncer(Duration::from_millis(200), None, move |result| {
        let Ok(events) = result else { return };
        let Some(state) = handle.try_state::<WatcherState>() else { return };
        for event in events {
            let kind = kind_of(&event);
            for path in &event.paths {
                let raw = path.to_string_lossy().replace('\\', "/");
                if state.registry.contains(&raw) {
                    let _ = handle.emit("fs:changed", FsChanged { path: raw, kind });
                }
            }
        }
    })
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    *guard = Some(debouncer);
    Ok(())
}

#[tauri::command]
pub fn watch(app: AppHandle, state: State<'_, WatcherState>, path: String) -> AppResult<()> {
    ensure_debouncer(&app, &state)?;
    state.registry.add(path.clone());
    let file = PathBuf::from(&path);
    let dir = file.parent().map(Path::to_path_buf).ok_or_else(|| {
        AppError::new(ErrorKind::InvalidPath, "La ruta no tiene carpeta padre").with_path(&path)
    })?;
    let key = normalise(&dir.to_string_lossy());
    if !state.dirs.lock().unwrap().insert(key) {
        return Ok(());
    }
    let mut guard = state.debouncer.lock().unwrap();
    if let Some(d) = guard.as_mut() {
        d.watch(&dir, RecursiveMode::NonRecursive)
            .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()).with_path(&path))?;
    }
    Ok(())
}

#[tauri::command]
pub fn unwatch(state: State<'_, WatcherState>, path: String) -> AppResult<()> {
    state.registry.remove(&path);
    Ok(())
}
```

Watching the parent directory instead of the file itself is deliberate. Editors that save by writing a temp file and renaming break file-level watches on Windows. The registry decides which events reach the frontend; an idle directory watch costs nothing, so `unwatch` only removes the path from the registry.

Add `.manage(commands::watcher::WatcherState::default())` and register both commands in `lib.rs`.

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri
git commit -m "feat(rust): debounced filesystem watcher emitting fs:changed"
```

---

### Task 5: Preferences, recent files, external links and startup paths

**Files:**
- Create: `src-tauri/src/commands/store.rs`, `src-tauri/src/commands/prefs.rs`, `src-tauri/src/commands/recent.rs`, `src-tauri/src/commands/shell.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Produces:
  - `get_prefs() -> serde_json::Value` (`{}` when absent or corrupt), `set_prefs(prefs: Value)`
  - `get_recent() -> Vec<RecentItem>`, `push_recent(path: String) -> Vec<RecentItem>`, `clear_recent()` where `RecentItem { path: String, openedMs: u64 }`
  - `open_external(url: String)`
  - `startup_paths() -> Vec<String>` which drains after the first call

- [ ] **Step 1: Write the failing tests**

In `store.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_file_returns_default() {
        let d = tempfile::tempdir().unwrap();
        let v: serde_json::Value = read_json_or_default(&d.path().join("prefs.json"), || json!({}));
        assert_eq!(v, json!({}));
    }

    #[test]
    fn corrupt_file_returns_default_instead_of_failing() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("prefs.json");
        std::fs::write(&p, "{ this is not json").unwrap();
        let v: serde_json::Value = read_json_or_default(&p, || json!({ "theme": "dark" }));
        assert_eq!(v, json!({ "theme": "dark" }));
    }

    #[test]
    fn write_creates_parent_directories_and_roundtrips() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("nested").join("prefs.json");
        write_json(&p, &json!({ "a": 1 })).unwrap();
        let v: serde_json::Value = read_json_or_default(&p, || json!({}));
        assert_eq!(v, json!({ "a": 1 }));
    }
}
```

In `recent.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn item(path: &str, ms: u64) -> RecentItem {
        RecentItem { path: path.into(), opened_ms: ms }
    }

    #[test]
    fn new_path_goes_first() {
        let list = merge(vec![item("a.md", 1)], "b.md".into(), 2);
        assert_eq!(list[0].path, "b.md");
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn existing_path_moves_to_front_without_duplicating() {
        let list = merge(vec![item("a.md", 1), item("b.md", 2)], "a.md".into(), 3);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "a.md");
        assert_eq!(list[0].opened_ms, 3);
    }

    #[test]
    fn same_path_with_different_separators_is_one_entry() {
        let list = merge(vec![item("C:/d/a.md", 1)], "C:\\d\\a.md".into(), 2);
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn list_is_capped_at_twenty() {
        let mut list: Vec<RecentItem> = (0..20).map(|i| item(&format!("{i}.md"), i)).collect();
        list = merge(list, "new.md".into(), 99);
        assert_eq!(list.len(), 20);
        assert_eq!(list[0].path, "new.md");
    }
}
```

In `shell.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_http_https_mailto() {
        assert!(is_allowed("https://example.com"));
        assert!(is_allowed("http://example.com"));
        assert!(is_allowed("mailto:a@b.com"));
    }

    #[test]
    fn rejects_dangerous_schemes() {
        assert!(!is_allowed("file:///C:/Windows/System32/cmd.exe"));
        assert!(!is_allowed("javascript:alert(1)"));
        assert!(!is_allowed("ms-settings:"));
        assert!(!is_allowed("evil-https://x"));
    }

    #[test]
    fn scheme_check_is_case_insensitive() {
        assert!(is_allowed("HTTPS://example.com"));
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: compile errors for `read_json_or_default`, `merge`, `is_allowed`.

- [ ] **Step 3: Implement store.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn config_file(app: &AppHandle, name: &str) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    Ok(dir.join(name))
}

pub fn read_json_or_default<T: DeserializeOwned>(path: &Path, fallback: impl Fn() -> T) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<T>(&s).ok())
        .unwrap_or_else(fallback)
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))?;
    }
    let data = serde_json::to_vec_pretty(value)
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    fs::write(path, data).map_err(|e| AppError::from_io(e, &path.to_string_lossy()))
}
```

- [ ] **Step 4: Implement prefs.rs**

```rust
use crate::commands::store::{config_file, read_json_or_default, write_json};
use crate::error::AppResult;
use serde_json::{json, Value};
use tauri::AppHandle;

const FILE: &str = "prefs.json";

#[tauri::command]
pub fn get_prefs(app: AppHandle) -> AppResult<Value> {
    Ok(read_json_or_default(&config_file(&app, FILE)?, || json!({})))
}

#[tauri::command]
pub fn set_prefs(app: AppHandle, prefs: Value) -> AppResult<()> {
    write_json(&config_file(&app, FILE)?, &prefs)
}
```

- [ ] **Step 5: Implement recent.rs**

```rust
use crate::commands::store::{config_file, read_json_or_default, write_json};
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const FILE: &str = "recent.json";
const MAX: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    pub path: String,
    pub opened_ms: u64,
}

fn key(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

pub fn merge(mut list: Vec<RecentItem>, path: String, now_ms: u64) -> Vec<RecentItem> {
    let k = key(&path);
    list.retain(|i| key(&i.path) != k);
    list.insert(0, RecentItem { path, opened_ms: now_ms });
    list.truncate(MAX);
    list
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

#[tauri::command]
pub fn get_recent(app: AppHandle) -> AppResult<Vec<RecentItem>> {
    Ok(read_json_or_default(&config_file(&app, FILE)?, Vec::new))
}

#[tauri::command]
pub fn push_recent(app: AppHandle, path: String) -> AppResult<Vec<RecentItem>> {
    let file = config_file(&app, FILE)?;
    let list = merge(read_json_or_default(&file, Vec::new), path, now_ms());
    write_json(&file, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn clear_recent(app: AppHandle) -> AppResult<()> {
    write_json(&config_file(&app, FILE)?, &Vec::<RecentItem>::new())
}
```

- [ ] **Step 6: Implement shell.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use tauri_plugin_opener::OpenerExt;

const SCHEMES: [&str; 3] = ["http://", "https://", "mailto:"];

pub fn is_allowed(url: &str) -> bool {
    let lower = url.to_lowercase();
    SCHEMES.iter().any(|s| lower.starts_with(s))
}

#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) -> AppResult<()> {
    if !is_allowed(&url) {
        return Err(AppError::new(ErrorKind::InvalidPath, "Esquema de URL no permitido"));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))
}
```

- [ ] **Step 7: Wire everything into commands/mod.rs and lib.rs**

`commands/mod.rs`:
```rust
pub mod dir;
pub mod fs;
pub mod prefs;
pub mod recent;
pub mod shell;
pub mod store;
pub mod watcher;

pub struct StartupPaths(pub std::sync::Mutex<Vec<String>>);

#[tauri::command]
pub fn startup_paths(state: tauri::State<'_, StartupPaths>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}
```

`lib.rs`:
```rust
mod commands;
mod error;

use tauri::{Emitter, Manager};

fn cli_paths(app: &tauri::AppHandle) -> Vec<String> {
    use tauri_plugin_cli::CliExt;
    let Ok(matches) = app.cli().matches() else { return Vec::new() };
    let Some(arg) = matches.args.get("paths") else { return Vec::new() };
    match &arg.value {
        serde_json::Value::String(s) => vec![s.clone()],
        serde_json::Value::Array(a) => a.iter().filter_map(|v| v.as_str().map(str::to_owned)).collect(),
        _ => Vec::new(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files: Vec<String> = argv.into_iter().skip(1).filter(|a| !a.starts_with('-')).collect();
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("app:open-paths", files);
        }))
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(commands::watcher::WatcherState::default())
        .setup(|app| {
            let paths = cli_paths(&app.handle().clone());
            app.manage(commands::StartupPaths(std::sync::Mutex::new(paths)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text,
            commands::fs::write_text,
            commands::fs::exists,
            commands::dir::list_dir,
            commands::watcher::watch,
            commands::watcher::unwatch,
            commands::prefs::get_prefs,
            commands::prefs::set_prefs,
            commands::recent::get_recent,
            commands::recent::push_recent,
            commands::recent::clear_recent,
            commands::shell::open_external,
            commands::startup_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 8: Run tests and build**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: all pass.

Run: `cd src-tauri && cargo build 2>&1 | tail -3`
Expected: `Finished`.

- [ ] **Step 9: Commit**

```bash
git add src-tauri
git commit -m "feat(rust): prefs, recent files, external links and startup paths"
```

---

### Task 6: Path utilities and the typed Rust bridge

**Files:**
- Create: `src/lib/fs/paths.ts`, `src/lib/fs/api.ts`, `src/lib/fs/events.ts`
- Test: `src/lib/fs/paths.test.ts`

**Interfaces:**
- Consumes: the Rust commands from Tasks 2-5.
- Produces:
  - `paths.ts`: `dirname(p: string): string`, `basename(p: string): string`, `extname(p: string): string`, `join(...parts: string[]): string`, `isMarkdown(p: string): boolean`, `titleFromPath(p: string | null): string`, `resolveRelative(docPath: string, rel: string): string`, `isAbsolute(p: string): boolean`, `isExternalUrl(s: string): boolean`
  - `api.ts`: `ReaderError` class with `kind` and `path`; `readText`, `writeText`, `exists`, `listDir`, `watch`, `unwatch`, `getPrefs`, `setPrefs`, `getRecent`, `pushRecent`, `clearRecent`, `openExternal`, `startupPaths`; types `TextFile { text, modifiedMs, lineEnding }`, `LineEnding = 'lf' | 'crlf'`, `Entry { name, path, is_dir, children? }`, `RecentItem { path, openedMs }`
  - `events.ts`: `onFsChanged(cb: (e: { path: string; kind: 'modified' | 'removed' }) => void): Promise<UnlistenFn>`, `onOpenPaths(cb: (paths: string[]) => void): Promise<UnlistenFn>`

Note: Rust returns `modified_ms` and `line_ending` in snake_case for `TextFile` (no serde rename on that struct), so `api.ts` maps them to camelCase at the boundary. `Entry` keeps `is_dir` as-is. `RecentItem` is already camelCase from serde.

- [ ] **Step 1: Write the failing tests for paths.ts**

```ts
import { describe, expect, it } from 'vitest';
import { basename, dirname, extname, isAbsolute, isExternalUrl, isMarkdown, join, resolveRelative, titleFromPath } from './paths';

describe('dirname', () => {
  it('returns the parent of a windows path', () => {
    expect(dirname('C:\\docs\\a.md')).toBe('C:/docs');
  });
  it('returns the parent of a posix path', () => {
    expect(dirname('/home/e/a.md')).toBe('/home/e');
  });
  it('returns empty string when there is no parent', () => {
    expect(dirname('a.md')).toBe('');
  });
});

describe('basename and extname', () => {
  it('extracts the file name', () => {
    expect(basename('C:/docs/a.md')).toBe('a.md');
  });
  it('lowercases the extension without the dot', () => {
    expect(extname('C:/docs/A.MD')).toBe('md');
  });
  it('returns empty extension when there is none', () => {
    expect(extname('C:/docs/LICENSE')).toBe('');
  });
});

describe('join', () => {
  it('joins with forward slashes and collapses duplicates', () => {
    expect(join('C:/docs/', '/assets', 'a.png')).toBe('C:/docs/assets/a.png');
  });
  it('ignores empty parts', () => {
    expect(join('C:/docs', '', 'a.png')).toBe('C:/docs/a.png');
  });
});

describe('isMarkdown', () => {
  it('accepts md and markdown', () => {
    expect(isMarkdown('a.md')).toBe(true);
    expect(isMarkdown('a.MARKDOWN')).toBe(true);
  });
  it('rejects other extensions', () => {
    expect(isMarkdown('a.txt')).toBe(false);
  });
});

describe('titleFromPath', () => {
  it('uses the file name', () => {
    expect(titleFromPath('C:/docs/mi nota.md')).toBe('mi nota.md');
  });
  it('falls back for unsaved documents', () => {
    expect(titleFromPath(null)).toBe('Sin título');
  });
});

describe('resolveRelative', () => {
  it('resolves a sibling file', () => {
    expect(resolveRelative('C:/docs/a.md', 'img/x.png')).toBe('C:/docs/img/x.png');
  });
  it('resolves a parent segment', () => {
    expect(resolveRelative('C:/docs/sub/a.md', '../img/x.png')).toBe('C:/docs/img/x.png');
  });
  it('collapses current-directory segments', () => {
    expect(resolveRelative('C:/docs/a.md', './x.png')).toBe('C:/docs/x.png');
  });
  it('returns absolute paths untouched', () => {
    expect(resolveRelative('C:/docs/a.md', 'D:/other/x.png')).toBe('D:/other/x.png');
  });
  it('decodes percent-encoded spaces', () => {
    expect(resolveRelative('C:/docs/a.md', 'mi%20imagen.png')).toBe('C:/docs/mi imagen.png');
  });
});

describe('isExternalUrl', () => {
  it('detects http, https and mailto', () => {
    expect(isExternalUrl('https://a.com')).toBe(true);
    expect(isExternalUrl('mailto:a@b.com')).toBe(true);
  });
  it('treats relative paths as internal', () => {
    expect(isExternalUrl('./a.md')).toBe(false);
  });
});

describe('isAbsolute', () => {
  it('detects drive letters and unc and posix roots', () => {
    expect(isAbsolute('C:/a')).toBe(true);
    expect(isAbsolute('//server/share')).toBe(true);
    expect(isAbsolute('/home')).toBe(true);
    expect(isAbsolute('a/b')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/fs/paths.test.ts`
Expected: FAIL, cannot resolve `./paths`.

- [ ] **Step 3: Implement paths.ts**

```ts
export function normalise(p: string): string {
  return p.replace(/\\/g, '/');
}

export function dirname(p: string): string {
  const n = normalise(p);
  const i = n.lastIndexOf('/');
  return i <= 0 ? (i === 0 ? '/' : '') : n.slice(0, i);
}

export function basename(p: string): string {
  const n = normalise(p);
  return n.slice(n.lastIndexOf('/') + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
}

export function join(...parts: string[]): string {
  return parts
    .filter((p) => p.length > 0)
    .map(normalise)
    .join('/')
    .replace(/\/{2,}/g, '/');
}

export function isAbsolute(p: string): boolean {
  const n = normalise(p);
  return /^[a-zA-Z]:\//.test(n) || n.startsWith('//') || n.startsWith('/');
}

export function isMarkdown(p: string): boolean {
  const e = extname(p);
  return e === 'md' || e === 'markdown';
}

export function titleFromPath(p: string | null): string {
  return p ? basename(p) : 'Sin título';
}

export function isExternalUrl(s: string): boolean {
  return /^(https?:|mailto:)/i.test(s);
}

export function resolveRelative(docPath: string, rel: string): string {
  let target = rel;
  try {
    target = decodeURI(rel);
  } catch {
    target = rel;
  }
  if (isAbsolute(target)) return normalise(target);
  const segments = normalise(dirname(docPath)).split('/');
  for (const part of normalise(target).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return segments.join('/');
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/fs/paths.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Implement api.ts (no tests; it is a thin boundary that jsdom cannot exercise)**

```ts
import { invoke } from '@tauri-apps/api/core';

export type ErrorKind = 'NotFound' | 'PermissionDenied' | 'NotUtf8' | 'Io' | 'InvalidPath';
export type LineEnding = 'lf' | 'crlf';

export interface TextFile {
  text: string;
  modifiedMs: number;
  lineEnding: LineEnding;
}

export interface Entry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: Entry[];
}

export interface RecentItem {
  path: string;
  openedMs: number;
}

export class ReaderError extends Error {
  kind: ErrorKind;
  path?: string;

  constructor(kind: ErrorKind, message: string, path?: string) {
    super(message);
    this.name = 'ReaderError';
    this.kind = kind;
    this.path = path;
  }
}

function toReaderError(raw: unknown): ReaderError {
  if (raw && typeof raw === 'object' && 'kind' in raw) {
    const e = raw as { kind: ErrorKind; message: string; path?: string };
    return new ReaderError(e.kind, e.message, e.path);
  }
  return new ReaderError('Io', String(raw));
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    throw toReaderError(raw);
  }
}

export async function readText(path: string): Promise<TextFile> {
  const r = await call<{ text: string; modified_ms: number; line_ending: LineEnding }>('read_text', { path });
  return { text: r.text, modifiedMs: r.modified_ms, lineEnding: r.line_ending };
}

export function writeText(path: string, text: string, lineEnding: LineEnding): Promise<number> {
  return call<number>('write_text', { path, text, lineEnding });
}

export function exists(path: string): Promise<boolean> {
  return call<boolean>('exists', { path });
}

export function listDir(path: string, depth = 2): Promise<Entry[]> {
  return call<Entry[]>('list_dir', { path, depth });
}

export function watch(path: string): Promise<void> {
  return call<void>('watch', { path });
}

export function unwatch(path: string): Promise<void> {
  return call<void>('unwatch', { path });
}

export function getPrefs<T>(): Promise<Partial<T>> {
  return call<Partial<T>>('get_prefs');
}

export function setPrefs(prefs: unknown): Promise<void> {
  return call<void>('set_prefs', { prefs });
}

export function getRecent(): Promise<RecentItem[]> {
  return call<RecentItem[]>('get_recent');
}

export function pushRecent(path: string): Promise<RecentItem[]> {
  return call<RecentItem[]>('push_recent', { path });
}

export function clearRecent(): Promise<void> {
  return call<void>('clear_recent');
}

export function openExternal(url: string): Promise<void> {
  return call<void>('open_external', { url });
}

export function startupPaths(): Promise<string[]> {
  return call<string[]>('startup_paths');
}
```

Tauri's `invoke` converts camelCase argument names to snake_case parameters automatically, so `lineEnding` maps to the `line_ending` parameter.

- [ ] **Step 6: Implement events.ts**

```ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface FsChanged {
  path: string;
  kind: 'modified' | 'removed';
}

export function onFsChanged(cb: (e: FsChanged) => void): Promise<UnlistenFn> {
  return listen<FsChanged>('fs:changed', (e) => cb(e.payload));
}

export function onOpenPaths(cb: (paths: string[]) => void): Promise<UnlistenFn> {
  return listen<string[]>('app:open-paths', (e) => cb(e.payload));
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/fs
git commit -m "feat(fs): path utilities and typed bridge to Rust commands"
```

---

### Task 7: Preferences store and theme tokens

**Files:**
- Create: `src/lib/state/prefs.svelte.ts`, `src/lib/i18n.ts`
- Modify: `src/app.css`
- Test: `src/lib/state/prefs.test.ts`

**Interfaces:**
- Consumes: `getPrefs`, `setPrefs` from `$lib/fs/api`.
- Produces:
  - `Prefs` interface and `DEFAULT_PREFS` constant
  - `mergePrefs(stored: Partial<Prefs>): Prefs` (pure, tested)
  - `prefs` object with `$state` fields, `loadPrefs(): Promise<void>`, `updatePrefs(patch: Partial<Prefs>): void`, `resolvedTheme(): 'light' | 'dark'`
  - `t(key: string): string` and `setLanguage(lang: 'es' | 'en')` in `i18n.ts`

```ts
export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  editorFont: string;
  editorFontSize: number;
  previewFont: string;
  previewFontSize: number;
  previewWidth: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autosave: 'off' | 'afterDelay' | 'onFocusChange';
  autosaveDelayMs: number;
  language: 'es' | 'en';
  splitRatio: number;
  lastFolder: string | null;
}
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, mergePrefs } from './prefs.svelte';

describe('mergePrefs', () => {
  it('returns defaults for an empty object', () => {
    expect(mergePrefs({})).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid stored values', () => {
    expect(mergePrefs({ theme: 'dark' }).theme).toBe('dark');
  });

  it('rejects a value outside the allowed set', () => {
    expect(mergePrefs({ theme: 'neon' as never }).theme).toBe(DEFAULT_PREFS.theme);
  });

  it('clamps the font size into range', () => {
    expect(mergePrefs({ editorFontSize: 2 }).editorFontSize).toBe(10);
    expect(mergePrefs({ editorFontSize: 400 }).editorFontSize).toBe(32);
  });

  it('clamps the split ratio', () => {
    expect(mergePrefs({ splitRatio: 0.01 }).splitRatio).toBe(0.2);
    expect(mergePrefs({ splitRatio: 0.99 }).splitRatio).toBe(0.8);
  });

  it('rejects a non-numeric autosave delay', () => {
    expect(mergePrefs({ autosaveDelayMs: NaN }).autosaveDelayMs).toBe(DEFAULT_PREFS.autosaveDelayMs);
  });

  it('ignores unknown keys', () => {
    const merged = mergePrefs({ nope: 1 } as never);
    expect('nope' in merged).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/state/prefs.test.ts`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Implement prefs.svelte.ts**

```ts
import { getPrefs, setPrefs } from '$lib/fs/api';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  editorFont: string;
  editorFontSize: number;
  previewFont: string;
  previewFontSize: number;
  previewWidth: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  autosave: 'off' | 'afterDelay' | 'onFocusChange';
  autosaveDelayMs: number;
  language: 'es' | 'en';
  splitRatio: number;
  lastFolder: string | null;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  editorFont: 'Cascadia Code, Consolas, monospace',
  editorFontSize: 14,
  previewFont: 'Segoe UI Variable Text, Segoe UI, system-ui, sans-serif',
  previewFontSize: 16,
  previewWidth: 760,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: false,
  autosave: 'afterDelay',
  autosaveDelayMs: 1000,
  language: 'es',
  splitRatio: 0.5,
  lastFolder: null,
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function clamped(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function mergePrefs(stored: Partial<Prefs>): Prefs {
  const d = DEFAULT_PREFS;
  return {
    theme: oneOf(stored.theme, ['system', 'light', 'dark'] as const, d.theme),
    editorFont: text(stored.editorFont, d.editorFont),
    editorFontSize: clamped(stored.editorFontSize, 10, 32, d.editorFontSize),
    previewFont: text(stored.previewFont, d.previewFont),
    previewFontSize: clamped(stored.previewFontSize, 12, 32, d.previewFontSize),
    previewWidth: clamped(stored.previewWidth, 480, 1600, d.previewWidth),
    tabSize: clamped(stored.tabSize, 1, 8, d.tabSize),
    wordWrap: bool(stored.wordWrap, d.wordWrap),
    lineNumbers: bool(stored.lineNumbers, d.lineNumbers),
    autosave: oneOf(stored.autosave, ['off', 'afterDelay', 'onFocusChange'] as const, d.autosave),
    autosaveDelayMs: clamped(stored.autosaveDelayMs, 200, 60000, d.autosaveDelayMs),
    language: oneOf(stored.language, ['es', 'en'] as const, d.language),
    splitRatio: clamped(stored.splitRatio, 0.2, 0.8, d.splitRatio),
    lastFolder: typeof stored.lastFolder === 'string' ? stored.lastFolder : null,
  };
}

class PrefsStore {
  current = $state<Prefs>({ ...DEFAULT_PREFS });
  private timer: ReturnType<typeof setTimeout> | null = null;

  async load(): Promise<void> {
    const stored = await getPrefs<Prefs>().catch(() => ({}) as Partial<Prefs>);
    this.current = mergePrefs(stored);
  }

  update(patch: Partial<Prefs>): void {
    this.current = mergePrefs({ ...this.current, ...patch });
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void setPrefs($state.snapshot(this.current)).catch(() => undefined);
    }, 300);
  }
}

export const prefs = new PrefsStore();

export function systemTheme(): 'light' | 'dark' {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolvedTheme(): 'light' | 'dark' {
  return prefs.current.theme === 'system' ? systemTheme() : prefs.current.theme;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/state/prefs.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write app.css with the full token set**

```css
:root {
  --bg: #ffffff;
  --bg-elevated: #f7f7f8;
  --bg-inset: #f0f0f2;
  --border: #e2e2e6;
  --border-strong: #c9c9cf;
  --text: #1b1b1f;
  --text-muted: #61616b;
  --text-faint: #8b8b95;
  --accent: #3060d0;
  --accent-contrast: #ffffff;
  --danger: #c02b2b;
  --warning: #9a6100;
  --selection: #cfdcfa;
  --code-bg: #f3f3f5;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  --radius: 6px;
  --titlebar-height: 38px;
  --statusbar-height: 24px;
  color-scheme: light;
}

:root[data-theme='dark'] {
  --bg: #17171a;
  --bg-elevated: #1e1e22;
  --bg-inset: #232328;
  --border: #2e2e34;
  --border-strong: #414149;
  --text: #e6e6ea;
  --text-muted: #a0a0aa;
  --text-faint: #74747e;
  --accent: #6f9bff;
  --accent-contrast: #10131c;
  --danger: #ff6b6b;
  --warning: #e0a458;
  --selection: #2b3a5e;
  --code-bg: #202026;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}

* { box-sizing: border-box; }

html, body, #app {
  margin: 0;
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

::selection { background: var(--selection); }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
}
```

The theme is applied by setting `document.documentElement.dataset.theme` from `App.svelte` in Task 13.

- [ ] **Step 6: Implement i18n.ts**

```ts
type Dict = Record<string, string>;

const es: Dict = {
  'app.untitled': 'Sin título',
  'menu.file': 'Archivo',
  'menu.new': 'Nuevo',
  'menu.open': 'Abrir archivo',
  'menu.openFolder': 'Abrir carpeta',
  'menu.save': 'Guardar',
  'menu.saveAs': 'Guardar como',
  'menu.exportHtml': 'Exportar a HTML',
  'menu.exportPdf': 'Exportar a PDF',
  'menu.settings': 'Preferencias',
  'menu.close': 'Cerrar pestaña',
  'view.editor': 'Solo editor',
  'view.split': 'Dividido',
  'view.preview': 'Solo lectura',
  'view.zen': 'Modo zen',
  'sidebar.files': 'Archivos',
  'sidebar.outline': 'Esquema',
  'sidebar.empty': 'No hay ninguna carpeta abierta',
  'welcome.title': 'Reader',
  'welcome.subtitle': 'Lector y editor de Markdown',
  'welcome.open': 'Abrir un archivo',
  'welcome.newFile': 'Documento nuevo',
  'welcome.recent': 'Recientes',
  'welcome.noRecent': 'Todavía no has abierto nada',
  'dialog.unsavedTitle': 'Hay cambios sin guardar',
  'dialog.unsavedBody': '¿Quieres guardar los cambios en {name}?',
  'dialog.save': 'Guardar',
  'dialog.discard': 'No guardar',
  'dialog.cancel': 'Cancelar',
  'reload.changed': '{name} ha cambiado en el disco',
  'reload.reload': 'Recargar',
  'reload.keep': 'Conservar mis cambios',
  'reload.deleted': '{name} se ha borrado del disco',
  'status.words': '{n} palabras',
  'status.chars': '{n} caracteres',
  'status.reading': '{n} min de lectura',
  'status.position': 'Ln {line}, Col {col}',
  'status.saved': 'Guardado',
  'status.saving': 'Guardando',
  'status.unsaved': 'Sin guardar',
  'error.notUtf8': 'Codificación no compatible; el archivo se abre en solo lectura',
  'error.tooLarge': 'Archivo muy grande; la vista previa está desactivada',
  'error.saveFailed': 'No se pudo guardar: {message}',
  'error.openFailed': 'No se pudo abrir: {message}',
  'settings.title': 'Preferencias',
  'settings.appearance': 'Apariencia',
  'settings.editor': 'Editor',
  'settings.preview': 'Vista previa',
  'settings.files': 'Archivos',
  'settings.theme': 'Tema',
  'settings.themeSystem': 'Del sistema',
  'settings.themeLight': 'Claro',
  'settings.themeDark': 'Oscuro',
  'settings.language': 'Idioma',
  'settings.fontSize': 'Tamaño de letra',
  'settings.wordWrap': 'Ajuste de línea',
  'settings.lineNumbers': 'Números de línea',
  'settings.autosave': 'Autoguardado',
  'settings.autosaveOff': 'Desactivado',
  'settings.autosaveDelay': 'Tras una pausa',
  'settings.autosaveFocus': 'Al perder el foco',
};

const en: Dict = {
  'app.untitled': 'Untitled',
  'menu.file': 'File',
  'menu.new': 'New',
  'menu.open': 'Open file',
  'menu.openFolder': 'Open folder',
  'menu.save': 'Save',
  'menu.saveAs': 'Save as',
  'menu.exportHtml': 'Export to HTML',
  'menu.exportPdf': 'Export to PDF',
  'menu.settings': 'Settings',
  'menu.close': 'Close tab',
  'view.editor': 'Editor only',
  'view.split': 'Split',
  'view.preview': 'Reading',
  'view.zen': 'Zen mode',
  'sidebar.files': 'Files',
  'sidebar.outline': 'Outline',
  'sidebar.empty': 'No folder open',
  'welcome.title': 'Reader',
  'welcome.subtitle': 'Markdown reader and editor',
  'welcome.open': 'Open a file',
  'welcome.newFile': 'New document',
  'welcome.recent': 'Recent',
  'welcome.noRecent': 'Nothing opened yet',
  'dialog.unsavedTitle': 'Unsaved changes',
  'dialog.unsavedBody': 'Do you want to save the changes to {name}?',
  'dialog.save': 'Save',
  'dialog.discard': "Don't save",
  'dialog.cancel': 'Cancel',
  'reload.changed': '{name} changed on disk',
  'reload.reload': 'Reload',
  'reload.keep': 'Keep my changes',
  'reload.deleted': '{name} was deleted from disk',
  'status.words': '{n} words',
  'status.chars': '{n} characters',
  'status.reading': '{n} min read',
  'status.position': 'Ln {line}, Col {col}',
  'status.saved': 'Saved',
  'status.saving': 'Saving',
  'status.unsaved': 'Unsaved',
  'error.notUtf8': 'Unsupported encoding; opened read-only',
  'error.tooLarge': 'File is very large; preview is disabled',
  'error.saveFailed': 'Could not save: {message}',
  'error.openFailed': 'Could not open: {message}',
  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.editor': 'Editor',
  'settings.preview': 'Preview',
  'settings.files': 'Files',
  'settings.theme': 'Theme',
  'settings.themeSystem': 'System',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.language': 'Language',
  'settings.fontSize': 'Font size',
  'settings.wordWrap': 'Word wrap',
  'settings.lineNumbers': 'Line numbers',
  'settings.autosave': 'Autosave',
  'settings.autosaveOff': 'Off',
  'settings.autosaveDelay': 'After a pause',
  'settings.autosaveFocus': 'On focus change',
};

const dictionaries: Record<'es' | 'en', Dict> = { es, en };

let current: 'es' | 'en' = 'es';

export function setLanguage(lang: 'es' | 'en'): void {
  current = lang;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = dictionaries[current][key] ?? dictionaries.es[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => String(vars[name] ?? m));
}
```

`t` is a plain function, so components that need to react to a language change read `prefs.current.language` in the same expression: `{(prefs.current.language, t('menu.save'))}`. Simpler alternative used throughout the UI: components call `t(...)` inside a `$derived` that also reads `prefs.current.language`.

- [ ] **Step 7: Run the whole suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add src/lib/state src/lib/i18n.ts src/app.css
git commit -m "feat(state): preferences store, theme tokens and translations"
```

---

### Task 8: Markdown pipeline and rendering with line mapping

**Files:**
- Create: `src/lib/preview/pipeline.ts`, `src/lib/preview/render.ts`
- Test: `src/lib/preview/render.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Produces:
  - `createMarkdown(): MarkdownIt` in `pipeline.ts`, with linkify on, typographer off, `html: true`, task lists, footnotes and heading anchors
  - `renderMarkdown(text: string): string` in `render.ts`, returning sanitised HTML where every top-level block carries `data-line="<start>"` (zero-based start line from the token map)
  - `sanitize(html: string): string`

- [ ] **Step 1: Install dependencies**

```bash
npm i markdown-it@15.0.1 markdown-it-task-lists@2.1.1 markdown-it-footnote@4.0.0 markdown-it-anchor@9.2.1 dompurify@3.4.14 morphdom@2.7.8
npm i -D @types/markdown-it@14.2.0
```

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render';

describe('renderMarkdown', () => {
  it('renders a heading', () => {
    expect(renderMarkdown('# Hola')).toContain('Hola</h1>');
  });

  it('marks top-level blocks with their start line', () => {
    const html = renderMarkdown('# Uno\n\nDos\n');
    expect(html).toMatch(/<h1[^>]*data-line="0"/);
    expect(html).toMatch(/<p[^>]*data-line="2"/);
  });

  it('gives headings an id for the outline', () => {
    expect(renderMarkdown('# Mi título')).toMatch(/id="[^"]+"/);
  });

  it('renders GitHub tables', () => {
    const html = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table');
    expect(html).toContain('<td>1</td>');
  });

  it('renders task list checkboxes as disabled inputs', () => {
    const html = renderMarkdown('- [x] hecho\n- [ ] pendiente');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('disabled');
  });

  it('renders footnotes', () => {
    const html = renderMarkdown('Texto[^1]\n\n[^1]: Nota');
    expect(html).toContain('footnote');
  });

  it('linkifies bare urls', () => {
    expect(renderMarkdown('ver https://example.com')).toContain('href="https://example.com"');
  });

  it('keeps straight quotes because typographer is off', () => {
    expect(renderMarkdown('"comillas"')).toContain('"comillas"');
  });

  it('strips script tags from raw html', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\ntexto');
    expect(html).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  it('keeps a fenced code block with its language class', () => {
    const html = renderMarkdown('```js\nconst a = 1;\n```');
    expect(html).toContain('language-js');
  });

  it('leaves math delimiters untouched for the lazy katex pass', () => {
    expect(renderMarkdown('$E = mc^2$')).toContain('$E = mc^2$');
  });

  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/preview/render.test.ts`
Expected: FAIL, cannot resolve `./render`.

- [ ] **Step 4: Implement pipeline.ts**

```ts
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function createMarkdown(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false,
    highlight: () => '',
  });
  md.use(taskLists, { enabled: true, label: true });
  md.use(footnote);
  md.use(anchor, { slugify, permalink: false, tabIndex: false });
  addLineNumbers(md);
  return md;
}

function addLineNumbers(md: MarkdownIt): void {
  const original = md.renderer.renderToken.bind(md.renderer);
  md.renderer.renderToken = (tokens, idx, options) => {
    const token = tokens[idx];
    if (token && token.nesting !== -1 && token.map && token.level === 0) {
      token.attrSet('data-line', String(token.map[0]));
    }
    return original(tokens, idx, options);
  };
}
```

The `highlight` callback returns an empty string so markdown-it falls back to escaping the code itself; the real highlighting is a later DOM pass in Task 10.

- [ ] **Step 5: Implement render.ts**

```ts
import DOMPurify from 'dompurify';
import { createMarkdown } from './pipeline';

const md = createMarkdown();

const PURIFY_CONFIG = {
  ADD_ATTR: ['data-line', 'target', 'rel', 'align', 'id', 'checked', 'disabled', 'type'],
  ADD_TAGS: ['svg', 'path', 'g', 'foreignObject', 'marker', 'defs', 'text', 'line', 'rect', 'circle', 'polygon'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
  ALLOW_DATA_ATTR: true,
};

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function renderMarkdown(text: string): string {
  if (text.length === 0) return '';
  return sanitize(md.render(text));
}
```

Task-list checkboxes are `input` elements, which `FORBID_TAGS` would remove. Instead of forbidding `input`, use a hook that keeps only disabled checkboxes:

```ts
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName !== 'input') return;
  const el = node as Element;
  const isTaskCheckbox = el.getAttribute('type') === 'checkbox' && el.hasAttribute('disabled');
  if (!isTaskCheckbox) el.remove();
});
```

Register the hook once at module load, and drop `input` from `FORBID_TAGS`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/preview/render.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/preview package.json package-lock.json
git commit -m "feat(preview): markdown-it pipeline with line mapping and sanitising"
```

---

### Task 9: Incremental DOM patching and outline extraction

**Files:**
- Create: `src/lib/preview/patch.ts`, `src/lib/preview/outline.ts`
- Test: `src/lib/preview/patch.test.ts`, `src/lib/preview/outline.test.ts`

**Interfaces:**
- Consumes: `renderMarkdown` from Task 8.
- Produces:
  - `patchPreview(root: HTMLElement, html: string): void`
  - `extractOutline(text: string): OutlineItem[]` where `OutlineItem { level: number; text: string; line: number; id: string }`
  - `activeOutlineIndex(items: OutlineItem[], line: number): number`

- [ ] **Step 1: Write the failing tests for patch.ts**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { patchPreview } from './patch';

function root(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('patchPreview', () => {
  it('fills an empty root', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">hola</p>');
    expect(el.querySelector('p')?.textContent).toBe('hola');
  });

  it('keeps the identity of a node whose content did not change', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    const first = el.querySelector('p');
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">DOS</p>');
    expect(el.querySelector('p')).toBe(first);
  });

  it('updates only the changed node text', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">DOS</p>');
    expect(el.querySelectorAll('p')[1]?.textContent).toBe('DOS');
  });

  it('removes nodes that disappeared', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p><p data-line="2">dos</p>');
    patchPreview(el, '<p data-line="0">uno</p>');
    expect(el.querySelectorAll('p').length).toBe(1);
  });

  it('clears the root for empty html', () => {
    const el = root();
    patchPreview(el, '<p data-line="0">uno</p>');
    patchPreview(el, '');
    expect(el.innerHTML).toBe('');
  });

  it('preserves a rendered mermaid block instead of re-patching it', () => {
    const el = root();
    patchPreview(el, '<pre data-line="0" class="mermaid" data-rendered="1"><svg></svg></pre>');
    const pre = el.querySelector('pre');
    patchPreview(el, '<pre data-line="0" class="mermaid">graph TD</pre>');
    expect(el.querySelector('pre')).toBe(pre);
    expect(el.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing tests for outline.ts**

```ts
import { describe, expect, it } from 'vitest';
import { activeOutlineIndex, extractOutline } from './outline';

describe('extractOutline', () => {
  it('finds atx headings with their level and line', () => {
    const items = extractOutline('# Uno\n\ntexto\n\n## Dos\n');
    expect(items).toEqual([
      { level: 1, text: 'Uno', line: 0, id: 'uno' },
      { level: 2, text: 'Dos', line: 4, id: 'dos' },
    ]);
  });

  it('ignores hashes inside fenced code blocks', () => {
    const items = extractOutline('```\n# no es título\n```\n\n# Sí\n');
    expect(items.map((i) => i.text)).toEqual(['Sí']);
  });

  it('ignores tilde fenced blocks too', () => {
    const items = extractOutline('~~~\n# no\n~~~\n');
    expect(items).toEqual([]);
  });

  it('strips inline markdown from the heading text', () => {
    expect(extractOutline('# Un **título** con `código`')[0]?.text).toBe('Un título con código');
  });

  it('ignores a hash without a following space', () => {
    expect(extractOutline('#notatitle\n')).toEqual([]);
  });

  it('deduplicates ids', () => {
    const items = extractOutline('# Uno\n\n# Uno\n');
    expect(items[1]?.id).toBe('uno-1');
  });

  it('returns an empty array for a document with no headings', () => {
    expect(extractOutline('solo texto')).toEqual([]);
  });
});

describe('activeOutlineIndex', () => {
  const items = extractOutline('# A\n\n## B\n\n## C\n');

  it('returns the last heading at or above the line', () => {
    expect(activeOutlineIndex(items, 3)).toBe(1);
  });

  it('returns zero before the first heading ends', () => {
    expect(activeOutlineIndex(items, 0)).toBe(0);
  });

  it('returns minus one when there are no items', () => {
    expect(activeOutlineIndex([], 5)).toBe(-1);
  });
});
```

- [ ] **Step 3: Run both to verify failure**

Run: `npx vitest run src/lib/preview`
Expected: FAIL, cannot resolve `./patch` and `./outline`.

- [ ] **Step 4: Implement patch.ts**

```ts
import morphdom from 'morphdom';

export function patchPreview(root: HTMLElement, html: string): void {
  if (html.length === 0) {
    root.replaceChildren();
    return;
  }
  const next = document.createElement(root.tagName.toLowerCase()) as HTMLElement;
  next.innerHTML = html;
  morphdom(root, next, {
    childrenOnly: true,
    onBeforeElUpdated(fromEl, toEl) {
      if (fromEl.isEqualNode(toEl)) return false;
      if (fromEl.hasAttribute('data-rendered') && fromEl.textContent === toEl.getAttribute('data-source')) {
        return false;
      }
      if (fromEl.classList.contains('mermaid') && fromEl.hasAttribute('data-rendered')) {
        return false;
      }
      return true;
    },
  });
}
```

- [ ] **Step 5: Implement outline.ts**

```ts
import { slugify } from './pipeline';

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
  id: string;
}

const FENCE = /^\s{0,3}(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function stripInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim();
}

export function extractOutline(text: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const used = new Map<string, number>();
  let inFence = false;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING.exec(line);
    if (!m) continue;
    const level = m[1]!.length;
    const heading = stripInline(m[2]!);
    const base = slugify(heading) || 'seccion';
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    items.push({ level, text: heading, line: i, id: seen === 0 ? base : `${base}-${seen}` });
  }
  return items;
}

export function activeOutlineIndex(items: OutlineItem[], line: number): number {
  if (items.length === 0) return -1;
  let index = 0;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i]!.line <= line) index = i;
    else break;
  }
  return index;
}
```

The id scheme must match markdown-it-anchor, which is configured with the same `slugify` and appends `-1`, `-2` for duplicates. Both produce `uno` then `uno-1`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/preview`
Expected: PASS, 16 new tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/preview
git commit -m "feat(preview): incremental DOM patching and outline extraction"
```

---

### Task 10: Lazy renderers for code, math and diagrams

**Files:**
- Create: `src/lib/preview/lazy.ts`
- Test: `src/lib/preview/lazy.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `needsHighlight(root: HTMLElement): boolean`, `needsMath(text: string): boolean`, `needsMermaid(root: HTMLElement): boolean`
  - `enhance(root: HTMLElement, text: string, theme: 'light' | 'dark'): Promise<void>` which loads and applies highlight.js, KaTeX and Mermaid only when needed
  - `resetLazyCaches(): void` for tests

- [ ] **Step 1: Install dependencies**

```bash
npm i highlight.js@11.12.0 katex@0.18.5 mermaid@11.17.2
```

- [ ] **Step 2: Write the failing tests**

The tests cover the detection predicates and the idempotence markers, not the third-party rendering itself.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { needsHighlight, needsMath, needsMermaid } from './lazy';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('needsHighlight', () => {
  it('is true for a code block with a language class', () => {
    expect(needsHighlight(root('<pre><code class="language-js">a</code></pre>'))).toBe(true);
  });

  it('is false for a code block without a language', () => {
    expect(needsHighlight(root('<pre><code>a</code></pre>'))).toBe(false);
  });

  it('is false once the block is marked as highlighted', () => {
    expect(needsHighlight(root('<pre><code class="language-js" data-rendered="1">a</code></pre>'))).toBe(false);
  });

  it('is false for mermaid blocks', () => {
    expect(needsHighlight(root('<pre><code class="language-mermaid">graph TD</code></pre>'))).toBe(false);
  });
});

describe('needsMath', () => {
  it('is true for inline math', () => {
    expect(needsMath('sea $x$ un número')).toBe(true);
  });

  it('is true for display math', () => {
    expect(needsMath('$$\\int f$$')).toBe(true);
  });

  it('is false for a lone dollar sign', () => {
    expect(needsMath('cuesta 5$ solamente')).toBe(false);
  });

  it('is false for a dollar inside a fenced block', () => {
    expect(needsMath('```\nconst a = "$x$";\n```')).toBe(false);
  });
});

describe('needsMermaid', () => {
  it('is true for an unrendered mermaid block', () => {
    expect(needsMermaid(root('<pre><code class="language-mermaid">graph TD</code></pre>'))).toBe(true);
  });

  it('is false once rendered', () => {
    expect(needsMermaid(root('<pre class="mermaid" data-rendered="1"><svg></svg></pre>'))).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/preview/lazy.test.ts`
Expected: FAIL, cannot resolve `./lazy`.

- [ ] **Step 4: Implement lazy.ts**

```ts
type Highlighter = typeof import('highlight.js/lib/core').default;
type Katex = typeof import('katex').default;
type Mermaid = typeof import('mermaid').default;

let highlighter: Promise<Highlighter> | null = null;
let katex: Promise<Katex> | null = null;
let mermaid: Promise<Mermaid> | null = null;
let mermaidTheme: 'light' | 'dark' | null = null;
let mermaidCounter = 0;

const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  json: () => import('highlight.js/lib/languages/json'),
  css: () => import('highlight.js/lib/languages/css'),
  xml: () => import('highlight.js/lib/languages/xml'),
  bash: () => import('highlight.js/lib/languages/bash'),
  python: () => import('highlight.js/lib/languages/python'),
  rust: () => import('highlight.js/lib/languages/rust'),
  go: () => import('highlight.js/lib/languages/go'),
  java: () => import('highlight.js/lib/languages/java'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  sql: () => import('highlight.js/lib/languages/sql'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  ini: () => import('highlight.js/lib/languages/ini'),
  diff: () => import('highlight.js/lib/languages/diff'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
};

const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  svelte: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  py: 'python',
  rs: 'rust',
  cs: 'csharp',
  yml: 'yaml',
  md: 'markdown',
  toml: 'ini',
  ps1: 'powershell',
};

const registered = new Set<string>();

export function resetLazyCaches(): void {
  highlighter = null;
  katex = null;
  mermaid = null;
  mermaidTheme = null;
  registered.clear();
}

function languageOf(el: Element): string | null {
  const cls = Array.from(el.classList).find((c) => c.startsWith('language-'));
  if (!cls) return null;
  const raw = cls.slice('language-'.length).toLowerCase();
  return ALIASES[raw] ?? raw;
}

export function needsHighlight(root: HTMLElement): boolean {
  return Array.from(root.querySelectorAll('pre > code[class*="language-"]')).some((el) => {
    const lang = languageOf(el);
    return lang !== null && lang !== 'mermaid' && !el.hasAttribute('data-rendered');
  });
}

export function needsMath(text: string): boolean {
  const withoutFences = text.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  return /\$\$[\s\S]+?\$\$/.test(withoutFences) || /(?<!\$)\$(?!\s)[^$\n]+?(?<!\s)\$(?!\$)/.test(withoutFences);
}

export function needsMermaid(root: HTMLElement): boolean {
  return root.querySelector('pre > code.language-mermaid:not([data-rendered])') !== null;
}

async function applyHighlight(root: HTMLElement): Promise<void> {
  if (!highlighter) {
    highlighter = import('highlight.js/lib/core').then((m) => m.default);
    await import('highlight.js/styles/github-dark.css');
  }
  const hljs = await highlighter;
  const blocks = Array.from(root.querySelectorAll('pre > code[class*="language-"]'));
  for (const block of blocks) {
    const lang = languageOf(block);
    if (!lang || lang === 'mermaid' || block.hasAttribute('data-rendered')) continue;
    const loader = LANGUAGE_LOADERS[lang];
    if (!loader) continue;
    if (!registered.has(lang)) {
      const mod = await loader();
      hljs.registerLanguage(lang, mod.default as never);
      registered.add(lang);
    }
    const result = hljs.highlight(block.textContent ?? '', { language: lang, ignoreIllegals: true });
    block.innerHTML = result.value;
    block.setAttribute('data-rendered', '1');
  }
}

async function applyMath(root: HTMLElement): Promise<void> {
  if (!katex) {
    katex = import('katex').then((m) => m.default);
    await import('katex/dist/katex.min.css');
  }
  const k = await katex;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('pre, code, .katex')) return NodeFilter.FILTER_REJECT;
      return /\$/.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const targets: Text[] = [];
  while (walker.nextNode()) targets.push(walker.currentNode as Text);
  for (const node of targets) {
    const source = node.nodeValue ?? '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      fragment.append(source.slice(cursor, match.index));
      const span = document.createElement('span');
      const expression = match[1] ?? match[2] ?? '';
      try {
        k.render(expression, span, { displayMode: match[1] !== undefined, throwOnError: false });
      } catch {
        span.textContent = match[0];
        span.className = 'math-error';
      }
      fragment.append(span);
      cursor = match.index + match[0].length;
    }
    if (cursor === 0) continue;
    fragment.append(source.slice(cursor));
    node.replaceWith(fragment);
  }
}

async function applyMermaid(root: HTMLElement, theme: 'light' | 'dark'): Promise<void> {
  if (!mermaid) {
    mermaid = import('mermaid').then((m) => m.default);
  }
  const m = await mermaid;
  if (mermaidTheme !== theme) {
    m.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default', securityLevel: 'strict' });
    mermaidTheme = theme;
  }
  const blocks = Array.from(root.querySelectorAll('pre > code.language-mermaid:not([data-rendered])'));
  for (const block of blocks) {
    const pre = block.parentElement;
    if (!pre) continue;
    const source = block.textContent ?? '';
    mermaidCounter += 1;
    try {
      const { svg } = await m.render(`mermaid-${mermaidCounter}`, source);
      pre.className = 'mermaid';
      pre.innerHTML = svg;
      pre.setAttribute('data-rendered', '1');
      pre.setAttribute('data-source', source);
    } catch (error) {
      pre.classList.add('mermaid-error');
      block.setAttribute('data-rendered', '1');
      const message = document.createElement('div');
      message.className = 'mermaid-message';
      message.textContent = error instanceof Error ? error.message : String(error);
      pre.append(message);
    }
  }
}

export async function enhance(root: HTMLElement, text: string, theme: 'light' | 'dark'): Promise<void> {
  const jobs: Promise<void>[] = [];
  if (needsHighlight(root)) jobs.push(applyHighlight(root));
  if (needsMath(text)) jobs.push(applyMath(root));
  if (needsMermaid(root)) jobs.push(applyMermaid(root, theme));
  await Promise.allSettled(jobs);
}
```

Mermaid rendering rewrites the `pre` into `class="mermaid" data-rendered="1"` with `data-source` set to the original text, which is exactly the shape `patchPreview` in Task 9 skips on the next patch.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/preview/lazy.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Verify the lazy chunks really are separate**

Run: `npm run build && ls dist/assets`
Expected: separate chunk files whose names include `katex`, `mermaid` and `core` (highlight.js). If any of them is folded into the entry chunk, the dynamic import was written as a static one; fix it before committing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/preview package.json package-lock.json
git commit -m "feat(preview): lazy highlight.js, KaTeX and Mermaid renderers"
```

---

### Task 11: Editor formatting commands and list continuation

**Files:**
- Create: `src/lib/editor/commands.ts`
- Test: `src/lib/editor/commands.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces (all take and return through a CodeMirror `EditorView`; the pure helpers are what the tests target):
  - `toggleWrap(view: EditorView, marker: string): boolean`
  - `toggleHeading(view: EditorView, level: number): boolean`
  - `toggleLinePrefix(view: EditorView, prefix: string): boolean`
  - `insertLink(view: EditorView, url?: string): boolean`
  - `continueList(view: EditorView): boolean`
  - Pure helpers exported for tests: `wrapSelection(text, from, to, marker)`, `headingLine(line, level)`, `linePrefixToggle(line, prefix)`, `listContinuation(line)`

- [ ] **Step 1: Install CodeMirror**

```bash
npm i codemirror@6.0.2 @codemirror/lang-markdown@6.5.2 @codemirror/language-data@6.5.2 @codemirror/state @codemirror/view @codemirror/commands @codemirror/search @codemirror/language
```

- [ ] **Step 2: Write the failing tests**

```ts
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { continueList, headingLine, linePrefixToggle, listContinuation, toggleHeading, toggleWrap, wrapSelection } from './commands';

function view(doc: string, anchor: number, head = anchor): EditorView {
  const state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) });
  return new EditorView({ state });
}

describe('wrapSelection', () => {
  it('wraps the selected range', () => {
    expect(wrapSelection('hola mundo', 0, 4, '**')).toEqual({ text: '**hola**', from: 0, to: 4, unwrapped: false });
  });

  it('unwraps when the range is already wrapped', () => {
    expect(wrapSelection('**hola** mundo', 2, 6, '**').unwrapped).toBe(true);
  });
});

describe('toggleWrap', () => {
  it('makes the selection bold', () => {
    const v = view('hola mundo', 0, 4);
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('**hola** mundo');
  });

  it('removes bold when applied twice', () => {
    const v = view('hola mundo', 0, 4);
    toggleWrap(v, '**');
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('hola mundo');
  });

  it('inserts an empty marker and places the cursor inside when nothing is selected', () => {
    const v = view('', 0);
    toggleWrap(v, '**');
    expect(v.state.doc.toString()).toBe('****');
    expect(v.state.selection.main.head).toBe(2);
  });

  it('leaves the selection covering the same text after wrapping', () => {
    const v = view('hola', 0, 4);
    toggleWrap(v, '*');
    expect(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)).toBe('hola');
  });
});

describe('headingLine', () => {
  it('adds hashes to a plain line', () => {
    expect(headingLine('texto', 2)).toBe('## texto');
  });

  it('replaces an existing heading level', () => {
    expect(headingLine('### texto', 1)).toBe('# texto');
  });

  it('removes the heading when the level matches', () => {
    expect(headingLine('## texto', 2)).toBe('texto');
  });
});

describe('toggleHeading', () => {
  it('turns the current line into a heading', () => {
    const v = view('texto', 2);
    toggleHeading(v, 1);
    expect(v.state.doc.toString()).toBe('# texto');
  });

  it('applies to every line touched by the selection', () => {
    const v = view('uno\ndos', 0, 7);
    toggleHeading(v, 2);
    expect(v.state.doc.toString()).toBe('## uno\n## dos');
  });
});

describe('linePrefixToggle', () => {
  it('adds a bullet', () => {
    expect(linePrefixToggle('texto', '- ')).toBe('- texto');
  });

  it('removes an existing bullet', () => {
    expect(linePrefixToggle('- texto', '- ')).toBe('texto');
  });

  it('keeps the leading indentation', () => {
    expect(linePrefixToggle('  texto', '> ')).toBe('  > texto');
  });
});

describe('listContinuation', () => {
  it('continues a bullet list', () => {
    expect(listContinuation('- uno')).toBe('- ');
  });

  it('continues a task list unchecked', () => {
    expect(listContinuation('- [x] hecho')).toBe('- [ ] ');
  });

  it('increments an ordered list', () => {
    expect(listContinuation('3. tres')).toBe('4. ');
  });

  it('keeps indentation', () => {
    expect(listContinuation('  - uno')).toBe('  - ');
  });

  it('returns an empty string for an empty list item so Enter closes the list', () => {
    expect(listContinuation('- ')).toBe('');
  });

  it('returns null for a non-list line', () => {
    expect(listContinuation('texto normal')).toBeNull();
  });

  it('continues a blockquote', () => {
    expect(listContinuation('> cita')).toBe('> ');
  });
});

describe('continueList', () => {
  it('inserts a new bullet on Enter', () => {
    const v = view('- uno', 5);
    expect(continueList(v)).toBe(true);
    expect(v.state.doc.toString()).toBe('- uno\n- ');
  });

  it('clears the item and does not add a bullet when the item is empty', () => {
    const v = view('- uno\n- ', 8);
    expect(continueList(v)).toBe(true);
    expect(v.state.doc.toString()).toBe('- uno\n');
  });

  it('declines a plain line so the default Enter runs', () => {
    const v = view('texto', 5);
    expect(continueList(v)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/editor/commands.test.ts`
Expected: FAIL, cannot resolve `./commands`.

- [ ] **Step 4: Implement commands.ts**

```ts
import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export interface WrapResult {
  text: string;
  from: number;
  to: number;
  unwrapped: boolean;
}

export function wrapSelection(doc: string, from: number, to: number, marker: string): WrapResult {
  const selected = doc.slice(from, to);
  const before = doc.slice(Math.max(0, from - marker.length), from);
  const after = doc.slice(to, to + marker.length);
  if (before === marker && after === marker) {
    return { text: selected, from: from - marker.length, to: to + marker.length, unwrapped: true };
  }
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
    return { text: selected.slice(marker.length, -marker.length), from, to, unwrapped: true };
  }
  return { text: `${marker}${selected}${marker}`, from, to, unwrapped: false };
}

export function toggleWrap(view: EditorView, marker: string): boolean {
  const doc = view.state.doc.toString();
  const changes = view.state.changeByRange((range) => {
    const result = wrapSelection(doc, range.from, range.to, marker);
    const anchor = result.unwrapped ? result.from : result.from + marker.length;
    const head = anchor + (result.unwrapped ? result.text.length : range.to - range.from);
    return {
      changes: { from: result.from, to: result.to, insert: result.text },
      range: EditorSelection.range(anchor, head),
    };
  });
  view.dispatch(changes, { scrollIntoView: true });
  view.focus();
  return true;
}

export function headingLine(line: string, level: number): string {
  const m = /^(#{1,6})\s+(.*)$/.exec(line);
  const hashes = '#'.repeat(level);
  if (m) {
    return m[1]!.length === level ? m[2]! : `${hashes} ${m[2]!}`;
  }
  return `${hashes} ${line}`;
}

function eachSelectedLine(view: EditorView, transform: (text: string) => string): boolean {
  const changes: ChangeSpec[] = [];
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n += 1) {
      const line = view.state.doc.line(n);
      changes.push({ from: line.from, to: line.to, insert: transform(line.text) });
    }
  }
  view.dispatch({ changes }, { scrollIntoView: true });
  view.focus();
  return true;
}

export function toggleHeading(view: EditorView, level: number): boolean {
  return eachSelectedLine(view, (text) => headingLine(text, level));
}

export function linePrefixToggle(line: string, prefix: string): string {
  const indent = /^\s*/.exec(line)?.[0] ?? '';
  const body = line.slice(indent.length);
  if (body.startsWith(prefix)) return indent + body.slice(prefix.length);
  return indent + prefix + body;
}

export function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  return eachSelectedLine(view, (text) => linePrefixToggle(text, prefix));
}

export function insertLink(view: EditorView, url = ''): boolean {
  const changes = view.state.changeByRange((range) => {
    const label = view.state.sliceDoc(range.from, range.to);
    const insert = `[${label}](${url})`;
    const cursor = label.length === 0 ? range.from + 1 : range.from + label.length + 3 + url.length;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(cursor),
    };
  });
  view.dispatch(changes, { scrollIntoView: true });
  view.focus();
  return true;
}

const BULLET = /^(\s*)([-*+])\s+(\[[ xX]\]\s+)?(.*)$/;
const ORDERED = /^(\s*)(\d+)([.)])\s+(.*)$/;
const QUOTE = /^(\s*)(>)\s+(.*)$/;

export function listContinuation(line: string): string | null {
  const bullet = BULLET.exec(line);
  if (bullet) {
    const body = bullet[4] ?? '';
    if (body.trim().length === 0) return '';
    const task = bullet[3] ? '[ ] ' : '';
    return `${bullet[1]}${bullet[2]} ${task}`;
  }
  const ordered = ORDERED.exec(line);
  if (ordered) {
    if ((ordered[4] ?? '').trim().length === 0) return '';
    return `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `;
  }
  const quote = QUOTE.exec(line);
  if (quote) {
    if ((quote[3] ?? '').trim().length === 0) return '';
    return `${quote[1]}> `;
  }
  return null;
}

export function continueList(view: EditorView): boolean {
  const range = view.state.selection.main;
  if (!range.empty) return false;
  const line = view.state.doc.lineAt(range.head);
  const continuation = listContinuation(line.text);
  if (continuation === null) return false;
  if (continuation === '') {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: EditorSelection.cursor(line.from),
      scrollIntoView: true,
    });
    return true;
  }
  view.dispatch({
    changes: { from: range.head, to: range.head, insert: `\n${continuation}` },
    selection: EditorSelection.cursor(range.head + 1 + continuation.length),
    scrollIntoView: true,
  });
  return true;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/editor/commands.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/editor package.json package-lock.json
git commit -m "feat(editor): markdown formatting commands and list continuation"
```

---

### Task 12: Editor factory, keymap and theme

**Files:**
- Create: `src/lib/editor/theme.ts`, `src/lib/editor/keymap.ts`, `src/lib/editor/create.ts`
- Test: `src/lib/editor/create.test.ts`

**Interfaces:**
- Consumes: the commands from Task 11, `Prefs` from Task 7.
- Produces:
  - `createEditor(options: CreateEditorOptions): EditorView` where `CreateEditorOptions { parent: HTMLElement; doc: string; prefs: Prefs; theme: 'light' | 'dark'; onChange(text: string): void; onCursor(line: number, col: number): void; onScrollLine(line: number): void }`
  - `reconfigureEditor(view: EditorView, prefs: Prefs, theme: 'light' | 'dark'): void`
  - `editorTheme(theme, prefs): Extension`
  - `readerKeymap: KeyBinding[]`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS } from '$lib/state/prefs.svelte';
import { createEditor, reconfigureEditor } from './create';

function mount(doc = ''): { view: ReturnType<typeof createEditor>; onChange: ReturnType<typeof vi.fn> } {
  const parent = document.createElement('div');
  document.body.append(parent);
  const onChange = vi.fn();
  const view = createEditor({
    parent,
    doc,
    prefs: DEFAULT_PREFS,
    theme: 'light',
    onChange,
    onCursor: () => undefined,
    onScrollLine: () => undefined,
  });
  return { view, onChange };
}

describe('createEditor', () => {
  it('mounts with the given document', () => {
    const { view } = mount('# hola');
    expect(view.state.doc.toString()).toBe('# hola');
  });

  it('reports changes through onChange', () => {
    const { view, onChange } = mount('');
    view.dispatch({ changes: { from: 0, insert: 'a' } });
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('does not report a pure selection change as a document change', () => {
    const { view, onChange } = mount('abc');
    view.dispatch({ selection: { anchor: 1 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies the configured tab size', () => {
    const { view } = mount('');
    expect(view.state.tabSize).toBe(DEFAULT_PREFS.tabSize);
  });

  it('reconfigures without losing the document or the cursor', () => {
    const { view } = mount('hola mundo');
    view.dispatch({ selection: { anchor: 4 } });
    reconfigureEditor(view, { ...DEFAULT_PREFS, editorFontSize: 20 }, 'dark');
    expect(view.state.doc.toString()).toBe('hola mundo');
    expect(view.state.selection.main.anchor).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/editor/create.test.ts`
Expected: FAIL, cannot resolve `./create`.

- [ ] **Step 3: Implement theme.ts**

```ts
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import type { Prefs } from '$lib/state/prefs.svelte';

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.5em', fontWeight: '700', color: 'var(--text)' },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700', color: 'var(--text)' },
  { tag: tags.heading3, fontSize: '1.15em', fontWeight: '600', color: 'var(--text)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--text)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--text-faint)' },
  { tag: tags.monospace, color: 'var(--warning)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--accent)' },
  { tag: tags.processingInstruction, color: 'var(--text-faint)' },
  { tag: tags.contentSeparator, color: 'var(--border-strong)' },
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.string, color: 'var(--warning)' },
  { tag: tags.comment, color: 'var(--text-faint)', fontStyle: 'italic' },
]);

export function editorTheme(theme: 'light' | 'dark', prefs: Prefs): Extension {
  return [
    EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: `${prefs.editorFontSize}px`,
          backgroundColor: 'var(--bg)',
          color: 'var(--text)',
        },
        '.cm-content': {
          fontFamily: prefs.editorFont,
          padding: '16px 0 40vh 0',
          caretColor: 'var(--accent)',
        },
        '.cm-scroller': { fontFamily: prefs.editorFont, lineHeight: '1.65' },
        '.cm-gutters': {
          backgroundColor: 'var(--bg)',
          color: 'var(--text-faint)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'var(--bg-inset)' },
        '.cm-activeLineGutter': { backgroundColor: 'var(--bg-inset)' },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
          backgroundColor: 'var(--selection)',
        },
        '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
        '.cm-panels': { backgroundColor: 'var(--bg-elevated)', color: 'var(--text)' },
        '.cm-searchMatch': { backgroundColor: 'var(--selection)' },
        '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' },
      },
      { dark: theme === 'dark' },
    ),
    syntaxHighlighting(markdownHighlight),
  ];
}
```

Install `@lezer/highlight` alongside if it is not already pulled in: `npm i @lezer/highlight`.

- [ ] **Step 4: Implement keymap.ts**

```ts
import { indentLess, indentMore } from '@codemirror/commands';
import type { KeyBinding } from '@codemirror/view';
import { continueList, insertLink, toggleHeading, toggleLinePrefix, toggleWrap } from './commands';

export const readerKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
  { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
  { key: 'Mod-`', run: (v) => toggleWrap(v, '`') },
  { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
  { key: 'Mod-k', run: (v) => insertLink(v) },
  { key: 'Mod-1', run: (v) => toggleHeading(v, 1) },
  { key: 'Mod-2', run: (v) => toggleHeading(v, 2) },
  { key: 'Mod-3', run: (v) => toggleHeading(v, 3) },
  { key: 'Mod-4', run: (v) => toggleHeading(v, 4) },
  { key: 'Mod-5', run: (v) => toggleHeading(v, 5) },
  { key: 'Mod-6', run: (v) => toggleHeading(v, 6) },
  { key: 'Mod-Shift-l', run: (v) => toggleLinePrefix(v, '- ') },
  { key: 'Mod-Shift-t', run: (v) => toggleLinePrefix(v, '- [ ] ') },
  { key: 'Mod-Shift-q', run: (v) => toggleLinePrefix(v, '> ') },
  { key: 'Enter', run: continueList },
  { key: 'Tab', run: indentMore, shift: indentLess },
];
```

- [ ] **Step 5: Implement create.ts**

```ts
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { bracketMatching, indentUnit } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import type { Prefs } from '$lib/state/prefs.svelte';
import { readerKeymap } from './keymap';
import { editorTheme } from './theme';

export interface CreateEditorOptions {
  parent: HTMLElement;
  doc: string;
  prefs: Prefs;
  theme: 'light' | 'dark';
  onChange: (text: string) => void;
  onCursor: (line: number, col: number) => void;
  onScrollLine: (line: number) => void;
}

const themeCompartment = new Compartment();
const wrapCompartment = new Compartment();
const gutterCompartment = new Compartment();
const tabCompartment = new Compartment();

export function createEditor(options: CreateEditorOptions): EditorView {
  const { parent, doc, prefs, theme, onChange, onCursor, onScrollLine } = options;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) onChange(update.state.doc.toString());
    if (update.selectionSet || update.docChanged) {
      const head = update.state.selection.main.head;
      const line = update.state.doc.lineAt(head);
      onCursor(line.number, head - line.from + 1);
    }
  });

  const scrollListener = EditorView.domEventHandlers({
    scroll(_event, view) {
      const top = view.scrollDOM.scrollTop;
      const block = view.lineBlockAtHeight(top);
      onScrollLine(view.state.doc.lineAt(block.from).number - 1);
    },
  });

  const state = EditorState.create({
    doc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      highlightSelectionMatches(),
      search({ top: true }),
      markdown({ base: markdownLanguage, codeLanguages: languages, addKeymap: false }),
      keymap.of([...readerKeymap, ...closeBracketsKeymap, ...searchKeymap, ...historyKeymap, ...defaultKeymap]),
      gutterCompartment.of(prefs.lineNumbers ? lineNumbers() : []),
      wrapCompartment.of(prefs.wordWrap ? EditorView.lineWrapping : []),
      tabCompartment.of([EditorState.tabSize.of(prefs.tabSize), indentUnit.of(' '.repeat(prefs.tabSize))]),
      themeCompartment.of(editorTheme(theme, prefs)),
      updateListener,
      scrollListener,
    ],
  });

  return new EditorView({ state, parent });
}

export function reconfigureEditor(view: EditorView, prefs: Prefs, theme: 'light' | 'dark'): void {
  view.dispatch({
    effects: [
      themeCompartment.reconfigure(editorTheme(theme, prefs)),
      wrapCompartment.reconfigure(prefs.wordWrap ? EditorView.lineWrapping : []),
      gutterCompartment.reconfigure(prefs.lineNumbers ? lineNumbers() : []),
      tabCompartment.reconfigure([EditorState.tabSize.of(prefs.tabSize), indentUnit.of(' '.repeat(prefs.tabSize))]),
    ],
  });
}
```

`readerKeymap` comes before `defaultKeymap` so its `Enter` and `Tab` bindings win, and it declines by returning `false` when the line is not a list, letting the default run.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/editor/create.test.ts`
Expected: PASS, 5 tests.

`lineBlockAtHeight` needs layout that jsdom does not provide; the scroll handler is only exercised in the real app, and the test never fires a scroll event.

- [ ] **Step 7: Commit**

```bash
git add src/lib/editor package.json package-lock.json
git commit -m "feat(editor): CodeMirror factory, keymap and theme"
```

---

### Task 13: Scroll synchronisation

**Files:**
- Create: `src/lib/preview/scroll-sync.ts`
- Test: `src/lib/preview/scroll-sync.test.ts`

**Interfaces:**
- Produces:
  - `buildLineMap(root: HTMLElement): LineAnchor[]` where `LineAnchor { line: number; top: number; height: number }`
  - `previewTopForLine(map: LineAnchor[], line: number): number`
  - `lineForPreviewTop(map: LineAnchor[], top: number): number`
  - `createSyncGuard(quietMs?: number): { claim(owner: 'editor' | 'preview'): boolean; release(): void }`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildLineMap, createSyncGuard, lineForPreviewTop, previewTopForLine, type LineAnchor } from './scroll-sync';

const map: LineAnchor[] = [
  { line: 0, top: 0, height: 40 },
  { line: 4, top: 40, height: 100 },
  { line: 10, top: 140, height: 60 },
];

describe('buildLineMap', () => {
  it('reads data-line and offsetTop from the rendered blocks', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1 data-line="0">a</h1><p data-line="3">b</p>';
    const built = buildLineMap(root);
    expect(built.map((a) => a.line)).toEqual([0, 3]);
  });

  it('ignores nodes without data-line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1 data-line="0">a</h1><p>b</p>';
    expect(buildLineMap(root)).toHaveLength(1);
  });

  it('sorts anchors by line', () => {
    const root = document.createElement('div');
    root.innerHTML = '<p data-line="5">b</p><p data-line="1">a</p>';
    expect(buildLineMap(root).map((a) => a.line)).toEqual([1, 5]);
  });
});

describe('previewTopForLine', () => {
  it('returns the exact top for an anchor line', () => {
    expect(previewTopForLine(map, 4)).toBe(40);
  });

  it('interpolates inside a block', () => {
    expect(previewTopForLine(map, 7)).toBe(90);
  });

  it('clamps before the first anchor', () => {
    expect(previewTopForLine(map, -3)).toBe(0);
  });

  it('returns the last anchor top past the end', () => {
    expect(previewTopForLine(map, 999)).toBe(140);
  });

  it('returns zero for an empty map', () => {
    expect(previewTopForLine([], 5)).toBe(0);
  });
});

describe('lineForPreviewTop', () => {
  it('inverts previewTopForLine at anchor points', () => {
    expect(lineForPreviewTop(map, 40)).toBe(4);
  });

  it('interpolates inside a block', () => {
    expect(lineForPreviewTop(map, 90)).toBe(7);
  });

  it('clamps to the first line above the map', () => {
    expect(lineForPreviewTop(map, -20)).toBe(0);
  });

  it('returns zero for an empty map', () => {
    expect(lineForPreviewTop([], 100)).toBe(0);
  });
});

describe('createSyncGuard', () => {
  it('lets the first claimer through', () => {
    const guard = createSyncGuard();
    expect(guard.claim('editor')).toBe(true);
  });

  it('blocks the other side while a claim is active', () => {
    const guard = createSyncGuard();
    guard.claim('editor');
    expect(guard.claim('preview')).toBe(false);
  });

  it('lets the same side keep scrolling', () => {
    const guard = createSyncGuard();
    guard.claim('editor');
    expect(guard.claim('editor')).toBe(true);
  });

  it('releases after the quiet period', () => {
    vi.useFakeTimers();
    const guard = createSyncGuard(100);
    guard.claim('editor');
    vi.advanceTimersByTime(150);
    expect(guard.claim('preview')).toBe(true);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/preview/scroll-sync.test.ts`
Expected: FAIL, cannot resolve module.

- [ ] **Step 3: Implement scroll-sync.ts**

```ts
export interface LineAnchor {
  line: number;
  top: number;
  height: number;
}

export function buildLineMap(root: HTMLElement): LineAnchor[] {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-line]'));
  const anchors = nodes
    .map((el) => ({
      line: Number(el.dataset.line),
      top: el.offsetTop,
      height: el.offsetHeight,
    }))
    .filter((a) => Number.isFinite(a.line));
  anchors.sort((a, b) => a.line - b.line);
  return anchors;
}

function segmentAt(map: LineAnchor[], line: number): { current: LineAnchor; next: LineAnchor | null } | null {
  if (map.length === 0) return null;
  let index = 0;
  for (let i = 0; i < map.length; i += 1) {
    if (map[i]!.line <= line) index = i;
    else break;
  }
  return { current: map[index]!, next: map[index + 1] ?? null };
}

export function previewTopForLine(map: LineAnchor[], line: number): number {
  const segment = segmentAt(map, line);
  if (!segment) return 0;
  const { current, next } = segment;
  if (line <= current.line) return current.top;
  if (!next) return current.top;
  const span = next.line - current.line;
  if (span <= 0) return current.top;
  const ratio = Math.min(1, (line - current.line) / span);
  return current.top + ratio * (next.top - current.top);
}

export function lineForPreviewTop(map: LineAnchor[], top: number): number {
  if (map.length === 0) return 0;
  if (top <= map[0]!.top) return map[0]!.line;
  let index = 0;
  for (let i = 0; i < map.length; i += 1) {
    if (map[i]!.top <= top) index = i;
    else break;
  }
  const current = map[index]!;
  const next = map[index + 1];
  if (!next) return current.line;
  const span = next.top - current.top;
  if (span <= 0) return current.line;
  const ratio = (top - current.top) / span;
  return Math.round(current.line + ratio * (next.line - current.line));
}

export function createSyncGuard(quietMs = 120): { claim(owner: 'editor' | 'preview'): boolean; release(): void } {
  let owner: 'editor' | 'preview' | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function release(): void {
    owner = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return {
    claim(next) {
      if (owner !== null && owner !== next) return false;
      owner = next;
      if (timer) clearTimeout(timer);
      timer = setTimeout(release, quietMs);
      return true;
    },
    release,
  };
}
```

`offsetTop` and `offsetHeight` are always zero in jsdom, so the `buildLineMap` tests assert only on line extraction and ordering. The interpolation functions are pure and fully covered.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/preview/scroll-sync.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/preview
git commit -m "feat(preview): bidirectional scroll synchronisation"
```

---

### Task 14: Document statistics and the documents store

**Files:**
- Create: `src/lib/stats.ts`, `src/lib/state/documents.svelte.ts`, `src/lib/state/ui.svelte.ts`, `src/lib/state/toasts.svelte.ts`
- Test: `src/lib/stats.test.ts`, `src/lib/state/documents.test.ts`

**Interfaces:**
- Consumes: `readText`, `writeText`, `watch`, `unwatch`, `pushRecent` from `$lib/fs/api`; `titleFromPath`, `dirname` from `$lib/fs/paths`.
- Produces:
  - `stats.ts`: `countWords(text: string): number`, `countChars(text: string): number`, `readingMinutes(words: number): number`
  - `documents.svelte.ts`: class `DocumentsStore` and singleton `documents` with `list`, `activeId`, `active`, `open(path)`, `openText(text, path)`, `create()`, `close(id)`, `save(id)`, `saveAs(id, path)`, `setText(id, text)`, `markExternalChange(id, kind)`, `reload(id)`, `LARGE_FILE_BYTES`
  - `Document` interface
  - `ui.svelte.ts`: `ui` with `viewMode`, `sidebar`, `zen`, `splitRatio`, `cycleViewMode()`
  - `toasts.svelte.ts`: `toasts` with `list`, `push(message, level, sticky)`, `dismiss(id)`

```ts
export interface Document {
  id: string;
  path: string | null;
  title: string;
  text: string;
  savedText: string;
  lineEnding: 'lf' | 'crlf';
  modifiedMs: number;
  readOnly: boolean;
  previewDisabled: boolean;
  externalChange: 'none' | 'modified' | 'removed';
  cursor: { line: number; col: number };
  scrollLine: number;
}
```

- [ ] **Step 1: Write the failing tests for stats.ts**

```ts
import { describe, expect, it } from 'vitest';
import { countChars, countWords, readingMinutes } from './stats';

describe('countWords', () => {
  it('counts plain words', () => {
    expect(countWords('uno dos tres')).toBe(3);
  });

  it('ignores extra whitespace and newlines', () => {
    expect(countWords('  uno \n\n dos  ')).toBe(2);
  });

  it('returns zero for an empty document', () => {
    expect(countWords('')).toBe(0);
  });

  it('counts words with accents as one word', () => {
    expect(countWords('canción número')).toBe(2);
  });

  it('does not count markdown punctuation as words', () => {
    expect(countWords('# Título\n\n- uno')).toBe(3);
  });
});

describe('countChars', () => {
  it('counts every character including spaces', () => {
    expect(countChars('a b')).toBe(3);
  });

  it('counts an emoji as one character', () => {
    expect(countChars('🙂')).toBe(1);
  });
});

describe('readingMinutes', () => {
  it('rounds up to at least one minute', () => {
    expect(readingMinutes(10)).toBe(1);
  });

  it('uses two hundred words per minute', () => {
    expect(readingMinutes(600)).toBe(3);
  });

  it('returns zero for an empty document', () => {
    expect(readingMinutes(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Implement stats.ts and run**

```ts
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}

export function countChars(text: string): number {
  return Array.from(text).length;
}

export function readingMinutes(words: number): number {
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 200));
}
```

Run: `npx vitest run src/lib/stats.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 3: Write the failing tests for the documents store**

The store calls the Rust bridge, so the test mocks `$lib/fs/api`.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();

vi.mock('$lib/fs/api', () => ({
  readText: vi.fn(async (path: string) => {
    if (!files.has(path)) {
      const { ReaderError } = await import('$lib/fs/api-types');
      throw new ReaderError('NotFound', 'no existe', path);
    }
    return { text: files.get(path)!, modifiedMs: 1, lineEnding: 'lf' as const };
  }),
  writeText: vi.fn(async (path: string, text: string) => {
    files.set(path, text);
    return 2;
  }),
  watch: vi.fn(async () => undefined),
  unwatch: vi.fn(async () => undefined),
  pushRecent: vi.fn(async () => []),
  exists: vi.fn(async (p: string) => files.has(p)),
}));

const { documents } = await import('./documents.svelte');
const api = await import('$lib/fs/api');

beforeEach(() => {
  files.clear();
  documents.reset();
  vi.clearAllMocks();
});

describe('open', () => {
  it('adds a document and makes it active', async () => {
    files.set('C:/d/a.md', '# hola');
    const id = await documents.open('C:/d/a.md');
    expect(documents.list).toHaveLength(1);
    expect(documents.activeId).toBe(id);
    expect(documents.active?.text).toBe('# hola');
  });

  it('uses the file name as the title', async () => {
    files.set('C:/d/a.md', '');
    await documents.open('C:/d/a.md');
    expect(documents.active?.title).toBe('a.md');
  });

  it('focuses the existing tab instead of opening a duplicate', async () => {
    files.set('C:/d/a.md', 'x');
    const first = await documents.open('C:/d/a.md');
    const second = await documents.open('C:/d/a.md');
    expect(second).toBe(first);
    expect(documents.list).toHaveLength(1);
  });

  it('starts a watcher for the opened path', async () => {
    files.set('C:/d/a.md', 'x');
    await documents.open('C:/d/a.md');
    expect(api.watch).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('records the file in recents', async () => {
    files.set('C:/d/a.md', 'x');
    await documents.open('C:/d/a.md');
    expect(api.pushRecent).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('disables the preview for a very large file', async () => {
    files.set('C:/d/big.md', 'x'.repeat(21 * 1024 * 1024));
    await documents.open('C:/d/big.md');
    expect(documents.active?.previewDisabled).toBe(true);
  });
});

describe('dirty tracking', () => {
  it('is clean right after opening', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    expect(documents.isDirty(id)).toBe(false);
  });

  it('becomes dirty after an edit', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    expect(documents.isDirty(id)).toBe(true);
  });

  it('is clean again after saving', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    await documents.save(id);
    expect(documents.isDirty(id)).toBe(false);
    expect(files.get('C:/d/a.md')).toBe('dos');
  });

  it('is clean again when the edit is undone back to the saved text', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'dos');
    documents.setText(id, 'uno');
    expect(documents.isDirty(id)).toBe(false);
  });
});

describe('create and saveAs', () => {
  it('creates an untitled document with no path', () => {
    const id = documents.create();
    expect(documents.byId(id)?.path).toBeNull();
    expect(documents.byId(id)?.title).toBe('Sin título');
  });

  it('save on an untitled document reports that a path is needed', async () => {
    const id = documents.create();
    await expect(documents.save(id)).resolves.toBe('needs-path');
  });

  it('saveAs writes the file and adopts the new path and title', async () => {
    const id = documents.create();
    documents.setText(id, 'contenido');
    await documents.saveAs(id, 'C:/d/nuevo.md');
    expect(files.get('C:/d/nuevo.md')).toBe('contenido');
    expect(documents.byId(id)?.title).toBe('nuevo.md');
    expect(documents.isDirty(id)).toBe(false);
  });
});

describe('close', () => {
  it('removes the document and stops watching', async () => {
    files.set('C:/d/a.md', 'x');
    const id = await documents.open('C:/d/a.md');
    documents.close(id);
    expect(documents.list).toHaveLength(0);
    expect(api.unwatch).toHaveBeenCalledWith('C:/d/a.md');
  });

  it('activates the neighbouring tab', async () => {
    files.set('C:/d/a.md', 'x');
    files.set('C:/d/b.md', 'y');
    const first = await documents.open('C:/d/a.md');
    const second = await documents.open('C:/d/b.md');
    documents.close(second);
    expect(documents.activeId).toBe(first);
  });

  it('leaves no active document when the last tab closes', async () => {
    files.set('C:/d/a.md', 'x');
    const id = await documents.open('C:/d/a.md');
    documents.close(id);
    expect(documents.activeId).toBeNull();
  });
});

describe('external changes', () => {
  it('reloads silently when the document is clean', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    expect(documents.byId(id)?.text).toBe('externo');
    expect(documents.byId(id)?.externalChange).toBe('none');
  });

  it('flags the conflict instead of reloading when the document is dirty', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    expect(documents.byId(id)?.text).toBe('mío');
    expect(documents.byId(id)?.externalChange).toBe('modified');
  });

  it('detaches the document when the file is removed', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    files.delete('C:/d/a.md');
    await documents.markExternalChange(id, 'removed');
    expect(documents.byId(id)?.path).toBeNull();
    expect(documents.byId(id)?.text).toBe('uno');
    expect(documents.isDirty(id)).toBe(true);
  });

  it('reload replaces the text and clears the flag', async () => {
    files.set('C:/d/a.md', 'uno');
    const id = await documents.open('C:/d/a.md');
    documents.setText(id, 'mío');
    files.set('C:/d/a.md', 'externo');
    await documents.markExternalChange(id, 'modified');
    await documents.reload(id);
    expect(documents.byId(id)?.text).toBe('externo');
    expect(documents.byId(id)?.externalChange).toBe('none');
  });
});
```

The mock's `ReaderError` import needs `ReaderError` to live in a module free of `@tauri-apps/api`, otherwise importing it inside the mock pulls in the very module being mocked. Move `ReaderError`, `ErrorKind`, `LineEnding`, `TextFile`, `Entry` and `RecentItem` from `api.ts` into a new `src/lib/fs/api-types.ts`, and have `api.ts` re-export them. Update Task 6's file list accordingly when you get here.

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run src/lib/state/documents.test.ts`
Expected: FAIL, cannot resolve `./documents.svelte`.

- [ ] **Step 5: Implement documents.svelte.ts**

```ts
import { pushRecent, readText, unwatch, watch, writeText } from '$lib/fs/api';
import type { LineEnding } from '$lib/fs/api-types';
import { normalise, titleFromPath } from '$lib/fs/paths';

export const LARGE_FILE_BYTES = 20 * 1024 * 1024;

export interface Document {
  id: string;
  path: string | null;
  title: string;
  text: string;
  savedText: string;
  lineEnding: LineEnding;
  modifiedMs: number;
  readOnly: boolean;
  previewDisabled: boolean;
  externalChange: 'none' | 'modified' | 'removed';
  cursor: { line: number; col: number };
  scrollLine: number;
}

export type SaveResult = 'saved' | 'needs-path' | 'unchanged';

let counter = 0;

function nextId(): string {
  counter += 1;
  return `doc-${counter}`;
}

function blank(path: string | null, text = ''): Document {
  return {
    id: nextId(),
    path,
    title: titleFromPath(path),
    text,
    savedText: text,
    lineEnding: 'lf',
    modifiedMs: 0,
    readOnly: false,
    previewDisabled: false,
    externalChange: 'none',
    cursor: { line: 1, col: 1 },
    scrollLine: 0,
  };
}

class DocumentsStore {
  list = $state<Document[]>([]);
  activeId = $state<string | null>(null);

  get active(): Document | null {
    return this.list.find((d) => d.id === this.activeId) ?? null;
  }

  byId(id: string): Document | null {
    return this.list.find((d) => d.id === id) ?? null;
  }

  isDirty(id: string): boolean {
    const doc = this.byId(id);
    return doc !== null && doc.text !== doc.savedText;
  }

  get hasDirty(): boolean {
    return this.list.some((d) => d.text !== d.savedText);
  }

  reset(): void {
    this.list = [];
    this.activeId = null;
  }

  findByPath(path: string): Document | null {
    const key = normalise(path).toLowerCase();
    return this.list.find((d) => d.path !== null && normalise(d.path).toLowerCase() === key) ?? null;
  }

  async open(path: string): Promise<string> {
    const existing = this.findByPath(path);
    if (existing) {
      this.activeId = existing.id;
      return existing.id;
    }
    const file = await readText(path);
    const doc = blank(path, file.text);
    doc.lineEnding = file.lineEnding;
    doc.modifiedMs = file.modifiedMs;
    doc.previewDisabled = file.text.length > LARGE_FILE_BYTES;
    this.list = [...this.list, doc];
    this.activeId = doc.id;
    void watch(path).catch(() => undefined);
    void pushRecent(path).catch(() => undefined);
    return doc.id;
  }

  create(): string {
    const doc = blank(null);
    this.list = [...this.list, doc];
    this.activeId = doc.id;
    return doc.id;
  }

  setText(id: string, text: string): void {
    const doc = this.byId(id);
    if (!doc) return;
    doc.text = text;
  }

  setCursor(id: string, line: number, col: number): void {
    const doc = this.byId(id);
    if (!doc) return;
    doc.cursor = { line, col };
  }

  setScrollLine(id: string, line: number): void {
    const doc = this.byId(id);
    if (!doc) return;
    doc.scrollLine = line;
  }

  async save(id: string): Promise<SaveResult> {
    const doc = this.byId(id);
    if (!doc) return 'unchanged';
    if (doc.path === null) return 'needs-path';
    if (doc.text === doc.savedText) return 'unchanged';
    doc.modifiedMs = await writeText(doc.path, doc.text, doc.lineEnding);
    doc.savedText = doc.text;
    doc.externalChange = 'none';
    return 'saved';
  }

  async saveAs(id: string, path: string): Promise<void> {
    const doc = this.byId(id);
    if (!doc) return;
    const previous = doc.path;
    doc.modifiedMs = await writeText(path, doc.text, doc.lineEnding);
    doc.savedText = doc.text;
    doc.path = path;
    doc.title = titleFromPath(path);
    doc.externalChange = 'none';
    if (previous !== null && previous !== path) void unwatch(previous).catch(() => undefined);
    void watch(path).catch(() => undefined);
    void pushRecent(path).catch(() => undefined);
  }

  close(id: string): void {
    const index = this.list.findIndex((d) => d.id === id);
    if (index === -1) return;
    const doc = this.list[index]!;
    if (doc.path !== null && !this.list.some((d) => d.id !== id && d.path === doc.path)) {
      void unwatch(doc.path).catch(() => undefined);
    }
    this.list = this.list.filter((d) => d.id !== id);
    if (this.activeId !== id) return;
    const neighbour = this.list[Math.min(index, this.list.length - 1)];
    this.activeId = neighbour ? neighbour.id : null;
  }

  async markExternalChange(id: string, kind: 'modified' | 'removed'): Promise<void> {
    const doc = this.byId(id);
    if (!doc || doc.path === null) return;
    if (kind === 'removed') {
      void unwatch(doc.path).catch(() => undefined);
      doc.path = null;
      doc.savedText = `${doc.text}\u0000`;
      doc.externalChange = 'removed';
      return;
    }
    if (this.isDirty(id)) {
      doc.externalChange = 'modified';
      return;
    }
    await this.reload(id);
  }

  async reload(id: string): Promise<void> {
    const doc = this.byId(id);
    if (!doc || doc.path === null) return;
    const file = await readText(doc.path);
    doc.text = file.text;
    doc.savedText = file.text;
    doc.lineEnding = file.lineEnding;
    doc.modifiedMs = file.modifiedMs;
    doc.externalChange = 'none';
  }

  dismissExternalChange(id: string): void {
    const doc = this.byId(id);
    if (doc) doc.externalChange = 'none';
  }
}

export const documents = new DocumentsStore();
```

The `removed` branch sets `savedText` to a value that can never equal `text` so the document reads as dirty, which is what the test asserts and what the user needs to see.

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/lib/state/documents.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 7: Implement ui.svelte.ts and toasts.svelte.ts**

```ts
export type ViewMode = 'editor' | 'split' | 'preview';
export type SidebarPanel = 'files' | 'outline' | null;

const ORDER: ViewMode[] = ['editor', 'split', 'preview'];

class UiStore {
  viewMode = $state<ViewMode>('split');
  sidebar = $state<SidebarPanel>(null);
  zen = $state(false);
  splitRatio = $state(0.5);
  settingsOpen = $state(false);
  folder = $state<string | null>(null);

  cycleViewMode(): void {
    const index = ORDER.indexOf(this.viewMode);
    this.viewMode = ORDER[(index + 1) % ORDER.length]!;
  }

  toggleSidebar(panel: Exclude<SidebarPanel, null>): void {
    this.sidebar = this.sidebar === panel ? null : panel;
  }

  toggleZen(): void {
    this.zen = !this.zen;
  }
}

export const ui = new UiStore();
```

```ts
export type ToastLevel = 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  level: ToastLevel;
  sticky: boolean;
}

let counter = 0;

class ToastStore {
  list = $state<Toast[]>([]);

  push(message: string, level: ToastLevel = 'info', sticky = false): number {
    counter += 1;
    const toast: Toast = { id: counter, message, level, sticky };
    this.list = [...this.list, toast];
    if (!sticky) setTimeout(() => this.dismiss(toast.id), 6000);
    return toast.id;
  }

  dismiss(id: number): void {
    this.list = this.list.filter((t) => t.id !== id);
  }
}

export const toasts = new ToastStore();
```

- [ ] **Step 8: Run the whole suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add src/lib
git commit -m "feat(state): documents, ui and toast stores with statistics"
```

---

### Task 15: Editor and preview components wired together

**Files:**
- Create: `src/lib/ui/Editor.svelte`, `src/lib/ui/Preview.svelte`, `src/lib/ui/SplitPane.svelte`, `src/lib/preview/links.ts`
- Test: `src/lib/preview/links.test.ts`

**Interfaces:**
- Consumes: `createEditor`, `reconfigureEditor` (Task 12), `renderMarkdown` (Task 8), `patchPreview` (Task 9), `enhance` (Task 10), scroll-sync (Task 13), `documents`, `ui`, `prefs`.
- Produces:
  - `links.ts`: `rewriteAssets(root: HTMLElement, docPath: string | null): void`, `handlePreviewClick(event: MouseEvent, docPath: string | null, openDoc: (path: string) => void): void`
  - `Editor.svelte` props `{ docId: string }`
  - `Preview.svelte` props `{ docId: string }`
  - `SplitPane.svelte` props `{ ratio: number; onratio: (r: number) => void; left: Snippet; right: Snippet }`

- [ ] **Step 1: Write the failing tests for links.ts**

```ts
import { describe, expect, it, vi } from 'vitest';
import { handlePreviewClick, rewriteAssets } from './links';

function root(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  document.body.append(el);
  return el;
}

describe('rewriteAssets', () => {
  it('resolves a relative image against the document folder', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toContain('C:/docs/img/a.png');
  });

  it('leaves an http image untouched', () => {
    const el = root('<img src="https://x.com/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://x.com/a.png');
  });

  it('leaves a data uri untouched', () => {
    const el = root('<img src="data:image/png;base64,AAA">');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAA');
  });

  it('does nothing for an unsaved document', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, null);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('img/a.png');
  });

  it('is idempotent', () => {
    const el = root('<img src="img/a.png">');
    rewriteAssets(el, 'C:/docs/nota.md');
    const first = el.querySelector('img')?.getAttribute('src');
    rewriteAssets(el, 'C:/docs/nota.md');
    expect(el.querySelector('img')?.getAttribute('src')).toBe(first);
  });
});

describe('handlePreviewClick', () => {
  it('opens a relative markdown link as a document', () => {
    const el = root('<a href="otro.md">x</a>');
    const openDoc = vi.fn();
    const anchor = el.querySelector('a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).toHaveBeenCalledWith('C:/docs/otro.md');
    expect(event.defaultPrevented).toBe(true);
  });

  it('ignores a click that is not on a link', () => {
    const el = root('<p>texto</p>');
    const openDoc = vi.fn();
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('p')!.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).not.toHaveBeenCalled();
  });

  it('scrolls to an anchor without opening a document', () => {
    const el = root('<h2 id="seccion">s</h2><a href="#seccion">x</a>');
    const openDoc = vi.fn();
    const anchor = el.querySelector('a')!;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    handlePreviewClick(event, 'C:/docs/nota.md', openDoc);
    expect(openDoc).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/preview/links.test.ts`
Expected: FAIL, cannot resolve `./links`.

- [ ] **Step 3: Implement links.ts**

```ts
import { convertFileSrc } from '@tauri-apps/api/core';
import { openExternal } from '$lib/fs/api';
import { isExternalUrl, isMarkdown, resolveRelative } from '$lib/fs/paths';

function isEmbedded(src: string): boolean {
  return /^(https?:|data:|blob:|asset:|http:\/\/asset\.localhost)/i.test(src);
}

export function rewriteAssets(root: HTMLElement, docPath: string | null): void {
  if (docPath === null) return;
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (img.hasAttribute('data-resolved')) continue;
    const src = img.getAttribute('src') ?? '';
    if (src.length === 0 || isEmbedded(src)) continue;
    const absolute = resolveRelative(docPath, src);
    img.setAttribute('src', convertFileSrc(absolute));
    img.setAttribute('data-resolved', '1');
  }
}

export function handlePreviewClick(
  event: MouseEvent,
  docPath: string | null,
  openDoc: (path: string) => void,
): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href') ?? '';
  if (href.length === 0) return;
  event.preventDefault();
  if (href.startsWith('#')) {
    const id = decodeURIComponent(href.slice(1));
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (isExternalUrl(href)) {
    void openExternal(href).catch(() => undefined);
    return;
  }
  if (docPath !== null && isMarkdown(href)) {
    openDoc(resolveRelative(docPath, href));
  }
}
```

In jsdom `convertFileSrc` returns a string containing the path, which is what the test asserts with `toContain`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/preview/links.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Implement SplitPane.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    ratio: number;
    onratio: (value: number) => void;
    left: Snippet;
    right: Snippet;
  }

  const { ratio, onratio, left, right }: Props = $props();

  let container = $state<HTMLElement | null>(null);
  let dragging = $state(false);

  function start(event: PointerEvent): void {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (!dragging || !container) return;
    const box = container.getBoundingClientRect();
    const next = (event.clientX - box.left) / box.width;
    onratio(Math.min(0.8, Math.max(0.2, next)));
  }

  function end(event: PointerEvent): void {
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function key(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') onratio(Math.max(0.2, ratio - 0.02));
    if (event.key === 'ArrowRight') onratio(Math.min(0.8, ratio + 0.02));
  }
</script>

<div class="split" bind:this={container} style="--ratio: {ratio}">
  <div class="pane">{@render left()}</div>
  <div
    class="divider"
    class:dragging
    role="separator"
    tabindex="0"
    aria-orientation="vertical"
    aria-valuenow={Math.round(ratio * 100)}
    onpointerdown={start}
    onpointermove={move}
    onpointerup={end}
    onkeydown={key}
  ></div>
  <div class="pane">{@render right()}</div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: calc(var(--ratio) * 100%) 1px 1fr;
    height: 100%;
    min-height: 0;
  }

  .pane {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .divider {
    position: relative;
    background: var(--border);
    cursor: col-resize;
  }

  .divider::after {
    content: '';
    position: absolute;
    inset: 0 -4px;
  }

  .divider:hover,
  .divider.dragging,
  .divider:focus-visible {
    background: var(--accent);
    outline: none;
  }
</style>
```

- [ ] **Step 6: Implement Editor.svelte**

```svelte
<script lang="ts">
  import type { EditorView } from '@codemirror/view';
  import { createEditor, reconfigureEditor } from '$lib/editor/create';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';

  interface Props {
    docId: string;
  }

  const { docId }: Props = $props();

  let host = $state<HTMLElement | null>(null);
  let view: EditorView | null = null;
  let applying = false;

  $effect(() => {
    if (!host) return;
    const doc = documents.byId(docId);
    if (!doc) return;
    view = createEditor({
      parent: host,
      doc: doc.text,
      prefs: prefs.current,
      theme: resolvedTheme(),
      onChange: (text) => {
        if (applying) return;
        documents.setText(docId, text);
      },
      onCursor: (line, col) => documents.setCursor(docId, line, col),
      onScrollLine: (line) => documents.setScrollLine(docId, line),
    });
    return () => {
      view?.destroy();
      view = null;
    };
  });

  $effect(() => {
    const size = prefs.current.editorFontSize;
    const wrap = prefs.current.wordWrap;
    const gutter = prefs.current.lineNumbers;
    const tab = prefs.current.tabSize;
    const theme = resolvedTheme();
    void size;
    void wrap;
    void gutter;
    void tab;
    if (view) reconfigureEditor(view, prefs.current, theme);
  });

  $effect(() => {
    const doc = documents.byId(docId);
    if (!view || !doc) return;
    if (doc.text === view.state.doc.toString()) return;
    applying = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc.text } });
    applying = false;
  });

  export function focus(): void {
    view?.focus();
  }

  export function scrollToLine(line: number): void {
    if (!view) return;
    const target = Math.min(Math.max(1, line + 1), view.state.doc.lines);
    const pos = view.state.doc.line(target).from;
    view.dispatch({ effects: [] , selection: { anchor: pos }, scrollIntoView: true });
  }
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    overflow: hidden;
  }

  .editor :global(.cm-editor) {
    height: 100%;
  }

  .editor :global(.cm-scroller) {
    overflow: auto;
  }
</style>
```

- [ ] **Step 7: Implement Preview.svelte**

```svelte
<script lang="ts">
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme } from '$lib/state/prefs.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { enhance } from '$lib/preview/lazy';
  import { handlePreviewClick, rewriteAssets } from '$lib/preview/links';
  import { patchPreview } from '$lib/preview/patch';
  import { renderMarkdown } from '$lib/preview/render';
  import { buildLineMap, previewTopForLine, type LineAnchor } from '$lib/preview/scroll-sync';

  interface Props {
    docId: string;
    onopen: (path: string) => void;
    onscrollline: (line: number) => void;
  }

  const { docId, onopen, onscrollline }: Props = $props();

  const DEBOUNCE_THRESHOLD = 200 * 1024;

  let scroller = $state<HTMLElement | null>(null);
  let content = $state<HTMLElement | null>(null);
  let anchors: LineAnchor[] = [];
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function apply(text: string, path: string | null): void {
    if (!content) return;
    patchPreview(content, renderMarkdown(text));
    rewriteAssets(content, path);
    anchors = buildLineMap(content);
    void enhance(content, text, resolvedTheme()).then(() => {
      if (content) anchors = buildLineMap(content);
    });
  }

  function schedule(text: string, path: string | null): void {
    if (timer) clearTimeout(timer);
    cancelAnimationFrame(frame);
    if (text.length > DEBOUNCE_THRESHOLD) {
      timer = setTimeout(() => apply(text, path), 80);
      return;
    }
    frame = requestAnimationFrame(() => apply(text, path));
  }

  $effect(() => {
    const doc = documents.byId(docId);
    if (!doc || doc.previewDisabled) return;
    schedule(doc.text, doc.path);
  });

  export function scrollToLine(line: number): void {
    if (scroller) scroller.scrollTop = previewTopForLine(anchors, line);
  }

  export function topLine(): number {
    if (!scroller) return 0;
    return lineForPreviewTop(anchors, scroller.scrollTop);
  }

  function onScroll(): void {
    onscrollline(topLine());
  }
</script>

<div
  class="preview"
  class:reading={ui.viewMode === 'preview'}
  bind:this={scroller}
  onscroll={onScroll}
  style="--preview-font: {prefs.current.previewFont}; --preview-size: {prefs.current.previewFontSize}px; --preview-width: {prefs.current.previewWidth}px"
>
  <div
    class="content markdown-body"
    bind:this={content}
    role="document"
    onclick={(event) => handlePreviewClick(event, documents.byId(docId)?.path ?? null, onopen)}
  ></div>
</div>
```

Import `lineForPreviewTop` alongside `previewTopForLine` from `$lib/preview/scroll-sync`. The full prop list is `{ docId, onopen, onscrollline }` where `onscrollline: (line: number) => void`.

Preview styles (same `<style>` block):

```css
.preview {
  height: 100%;
  overflow: auto;
  background: var(--bg);
}

.content {
  font-family: var(--preview-font);
  font-size: var(--preview-size);
  line-height: 1.7;
  padding: 24px 32px 40vh;
  max-width: none;
}

.preview.reading .content {
  max-width: var(--preview-width);
  margin: 0 auto;
  padding: 48px 24px 40vh;
}
```

Global markdown styles live in `src/lib/ui/markdown.css`, imported once from `App.svelte`: headings with generous top margin, `code` on `--code-bg`, `pre` with horizontal scroll, `blockquote` with a left border in `--border-strong`, `table` with collapsed borders and zebra rows in `--bg-inset`, `img` with `max-width: 100%`, task-list items without bullets, `hr` as a single `--border` line, `.mermaid svg` centred, `.mermaid-error` with a `--danger` left border, `.math-error` in `--danger`.

- [ ] **Step 8: Run the suite and commit**

Run: `npm test`
Expected: all pass.

```bash
git add src/lib
git commit -m "feat(ui): editor, preview and split pane components"
```

---

### Task 16: Application shell, title bar, tabs, sidebar and status bar

**Files:**
- Create: `src/lib/ui/TitleBar.svelte`, `src/lib/ui/Tabs.svelte`, `src/lib/ui/Sidebar.svelte`, `src/lib/ui/FileTree.svelte`, `src/lib/ui/Outline.svelte`, `src/lib/ui/StatusBar.svelte`, `src/lib/ui/Welcome.svelte`, `src/lib/ui/Dialog.svelte`, `src/lib/ui/Toasts.svelte`, `src/lib/ui/Settings.svelte`, `src/lib/ui/markdown.css`
- Modify: `src/App.svelte`
- Test: `src/lib/ui/Tabs.test.ts`, `src/lib/ui/Outline.test.ts`

**Interfaces:**
- Consumes: every store and component from Tasks 6-15.
- Produces: a complete window. `App.svelte` owns the wiring: it loads prefs, applies the theme to `document.documentElement.dataset.theme`, opens startup paths, subscribes to `fs:changed` and `app:open-paths`, shows the window once mounted, and connects editor and preview scrolling through the sync guard.

- [ ] **Step 1: Write the failing component tests**

```ts
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Tabs from './Tabs.svelte';

const docs = [
  { id: 'a', title: 'uno.md', dirty: false },
  { id: 'b', title: 'dos.md', dirty: true },
];

describe('Tabs', () => {
  it('renders one tab per document', () => {
    render(Tabs, { items: docs, activeId: 'a', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('marks the active tab', () => {
    render(Tabs, { items: docs, activeId: 'b', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getByRole('tab', { selected: true }).textContent).toContain('dos.md');
  });

  it('shows a dirty indicator only on modified documents', () => {
    render(Tabs, { items: docs, activeId: 'a', onselect: vi.fn(), onclose: vi.fn() });
    expect(screen.getAllByTitle('Sin guardar')).toHaveLength(1);
  });

  it('calls onselect with the document id', async () => {
    const onselect = vi.fn();
    const { component } = render(Tabs, { items: docs, activeId: 'a', onselect, onclose: vi.fn() });
    void component;
    (screen.getAllByRole('tab')[1] as HTMLElement).click();
    expect(onselect).toHaveBeenCalledWith('b');
  });

  it('calls onclose from the close button without selecting', () => {
    const onselect = vi.fn();
    const onclose = vi.fn();
    render(Tabs, { items: docs, activeId: 'a', onselect, onclose });
    (screen.getAllByLabelText('Cerrar pestaña')[0] as HTMLElement).click();
    expect(onclose).toHaveBeenCalledWith('a');
    expect(onselect).not.toHaveBeenCalled();
  });
});
```

```ts
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Outline from './Outline.svelte';

const items = [
  { level: 1, text: 'Uno', line: 0, id: 'uno' },
  { level: 2, text: 'Dos', line: 4, id: 'dos' },
];

describe('Outline', () => {
  it('renders one entry per heading', () => {
    render(Outline, { items, activeIndex: 0, onselect: vi.fn() });
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('indents by heading level', () => {
    render(Outline, { items, activeIndex: 0, onselect: vi.fn() });
    expect(screen.getByText('Dos').closest('button')?.dataset.level).toBe('2');
  });

  it('marks the active heading', () => {
    render(Outline, { items, activeIndex: 1, onselect: vi.fn() });
    expect(screen.getByText('Dos').closest('button')?.getAttribute('aria-current')).toBe('true');
  });

  it('reports the line when an entry is clicked', () => {
    const onselect = vi.fn();
    render(Outline, { items, activeIndex: 0, onselect });
    screen.getByText('Dos').click();
    expect(onselect).toHaveBeenCalledWith(4);
  });

  it('shows a placeholder when there are no headings', () => {
    render(Outline, { items: [], activeIndex: -1, onselect: vi.fn() });
    expect(screen.getByText('Sin títulos')).toBeTruthy();
  });
});
```

Add `'sin títulos'` to `i18n.ts` as `'sidebar.noHeadings': 'Sin títulos'` and `'No headings'`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/ui`
Expected: FAIL, components not found.

- [ ] **Step 3: Implement Tabs.svelte**

```svelte
<script lang="ts">
  interface TabItem {
    id: string;
    title: string;
    dirty: boolean;
  }

  interface Props {
    items: TabItem[];
    activeId: string | null;
    onselect: (id: string) => void;
    onclose: (id: string) => void;
  }

  const { items, activeId, onselect, onclose }: Props = $props();
</script>

<div class="tabs" role="tablist">
  {#each items as item (item.id)}
    <div
      class="tab"
      class:active={item.id === activeId}
      role="tab"
      tabindex="0"
      aria-selected={item.id === activeId}
      onclick={() => onselect(item.id)}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onselect(item.id);
      }}
      onauxclick={(e) => {
        if (e.button === 1) onclose(item.id);
      }}
    >
      <span class="title">{item.title}</span>
      {#if item.dirty}
        <span class="dot" title="Sin guardar" aria-hidden="true"></span>
      {/if}
      <button
        class="close"
        aria-label="Cerrar pestaña"
        onclick={(e) => {
          e.stopPropagation();
          onclose(item.id);
        }}
      >×</button>
    </div>
  {/each}
</div>
```

Styles: a horizontal flex row that scrolls, tabs 32 px tall with `--bg-elevated` when inactive and `--bg` when active, a 2 px `--accent` top border on the active tab, the dirty dot a 6 px circle in `--text-muted`, and the close button revealed on hover or when the tab is active.

- [ ] **Step 4: Implement Outline.svelte**

```svelte
<script lang="ts">
  import type { OutlineItem } from '$lib/preview/outline';
  import { t } from '$lib/i18n';

  interface Props {
    items: OutlineItem[];
    activeIndex: number;
    onselect: (line: number) => void;
  }

  const { items, activeIndex, onselect }: Props = $props();
</script>

{#if items.length === 0}
  <p class="empty">{t('sidebar.noHeadings')}</p>
{:else}
  <nav class="outline">
    {#each items as item, index (item.line)}
      <button
        data-level={item.level}
        style="padding-left: {8 + (item.level - 1) * 12}px"
        aria-current={index === activeIndex ? 'true' : undefined}
        class:active={index === activeIndex}
        onclick={() => onselect(item.line)}
      >{item.text}</button>
    {/each}
  </nav>
{/if}
```

- [ ] **Step 5: Implement the remaining components**

`TitleBar.svelte`: a 38 px bar with `data-tauri-drag-region` on the background, a menu button on the left opening a popover with New, Open file, Open folder, Save, Save as, Export HTML, Export PDF, Settings, the tab strip in the middle, view-mode buttons and window controls (minimise, maximise/restore, close) on the right. Window controls call `getCurrentWindow().minimize()`, `.toggleMaximize()`, `.close()` from `@tauri-apps/api/window`. Close goes through the app's unsaved-changes flow, so it calls a `onrequestclose` prop rather than closing directly.

`FileTree.svelte`: recursive rendering of `Entry[]` from `listDir`. Directories toggle open on click and lazily call `listDir(child.path, 2)` when expanded for the first time. Files call `onopen(path)`. Keyboard: Enter opens, ArrowRight expands, ArrowLeft collapses.

`Sidebar.svelte`: a 240 px column with two tab buttons (Files, Outline) and the matching panel, plus a drag handle on its right edge to resize between 180 px and 420 px.

`StatusBar.svelte`: 24 px bar showing word count, character count, reading time, `Ln x, Col y`, line ending as a clickable button that toggles LF/CRLF, and the save indicator.

`Welcome.svelte`: shown when there are no documents. App name, subtitle, two large buttons (Open a file, New document) and the recent list from `getRecent()`, each row showing the file name and its folder in `--text-muted`.

`Dialog.svelte`: a modal with a title, body, and up to three buttons. Focus is trapped, Escape cancels, and the promise-based helper `confirmUnsaved(name): Promise<'save' | 'discard' | 'cancel'>` lives in the same file.

`Toasts.svelte`: bottom-right stack reading `toasts.list`, each with a close button; error toasts use a `--danger` left border.

`Settings.svelte`: a modal with the four groups from `i18n.ts` bound to `prefs.update({...})`.

- [ ] **Step 6: Implement App.svelte**

```svelte
<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { onMount } from 'svelte';
  import { open as openFileDialog, save as saveFileDialog } from '@tauri-apps/plugin-dialog';
  import { startupPaths } from '$lib/fs/api';
  import { onFsChanged, onOpenPaths } from '$lib/fs/events';
  import { dirname } from '$lib/fs/paths';
  import { extractOutline, activeOutlineIndex } from '$lib/preview/outline';
  import { createSyncGuard } from '$lib/preview/scroll-sync';
  import { documents } from '$lib/state/documents.svelte';
  import { prefs, resolvedTheme, systemTheme } from '$lib/state/prefs.svelte';
  import { toasts } from '$lib/state/toasts.svelte';
  import { ui } from '$lib/state/ui.svelte';
  import { setLanguage, t } from '$lib/i18n';
  import { registerShortcuts } from '$lib/shortcuts';
  import '$lib/ui/markdown.css';
</script>
```

The script body:

1. `onMount`: `await prefs.load()`, `setLanguage(prefs.current.language)`, `ui.splitRatio = prefs.current.splitRatio`, `ui.folder = prefs.current.lastFolder`, then `const paths = await startupPaths()` and open each. Then `await getCurrentWindow().show()`.
2. An effect that writes `document.documentElement.dataset.theme = resolvedTheme()` and listens to `matchMedia('(prefers-color-scheme: dark)')` changes while `prefs.current.theme === 'system'`.
3. An effect that keeps `document.title` as the active document title plus a bullet when dirty.
4. `onFsChanged`: find the document by path and call `documents.markExternalChange(id, kind)`; on `modified` with a dirty document, the reload bar appears above the editor.
5. `onOpenPaths`: open each path as a tab.
6. Autosave: an effect watching the active document's text that, when `prefs.current.autosave === 'afterDelay'` and the document has a path, saves after `autosaveDelayMs`. A `blur` listener on the window saves when the mode is `onFocusChange`.
7. `registerShortcuts` from Task 17, wired to the same handlers the menu uses.
8. Window close: `getCurrentWindow().onCloseRequested(async (event) => { ... })` walks the dirty documents, asks per document with `confirmUnsaved`, and calls `event.preventDefault()` if the user cancels.
9. Scroll sync: `const guard = createSyncGuard()`. The editor's `onScrollLine` calls `if (guard.claim('editor')) preview.scrollToLine(line)`. The preview's `onscrollline` calls `if (guard.claim('preview')) editor.scrollToLine(line)`.
10. The outline is `$derived(extractOutline(documents.active?.text ?? ''))` and the active index `$derived(activeOutlineIndex(outline, (documents.active?.cursor.line ?? 1) - 1))`.

Layout:

```svelte
<div class="app" class:zen={ui.zen}>
  {#if !ui.zen}
    <TitleBar ... />
  {/if}
  <div class="body">
    {#if ui.sidebar && !ui.zen}
      <Sidebar ... />
    {/if}
    <main>
      {#if documents.list.length === 0}
        <Welcome ... />
      {:else if ui.viewMode === 'split'}
        <SplitPane ratio={ui.splitRatio} onratio={(r) => { ui.splitRatio = r; prefs.update({ splitRatio: r }); }}>
          {#snippet left()}<Editor ... />{/snippet}
          {#snippet right()}<Preview ... />{/snippet}
        </SplitPane>
      {:else if ui.viewMode === 'editor'}
        <Editor ... />
      {:else}
        <Preview ... />
      {/if}
    </main>
  </div>
  {#if !ui.zen}
    <StatusBar ... />
  {/if}
  <Toasts />
</div>
```

Grid: `grid-template-rows: auto 1fr auto` with `height: 100%`, and `.body` as `display: flex; min-height: 0`.

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: PASS, including the 10 new component tests.

- [ ] **Step 8: Run the app and check it by hand**

Run: `npm run tauri dev`

Confirm: the window appears with no white flash, the welcome screen shows, opening a file renders both panes, editing updates the preview, scrolling one pane moves the other, and the theme follows Windows.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "feat(ui): application shell with title bar, tabs, sidebar and status bar"
```

---

### Task 17: Global shortcuts

**Files:**
- Create: `src/lib/shortcuts.ts`
- Test: `src/lib/shortcuts.test.ts`
- Modify: `src/App.svelte`

**Interfaces:**
- Produces:
  - `matchShortcut(event: KeyboardEvent): string | null` returning an action name
  - `registerShortcuts(handlers: Record<string, () => void>): () => void`
  - Action names: `new`, `open`, `openFolder`, `save`, `saveAs`, `close`, `cycleView`, `toggleFiles`, `toggleOutline`, `toggleZen`, `exitZen`, `settings`, `nextTab`, `prevTab`, `exportHtml`, `print`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { matchShortcut, registerShortcuts } from './shortcuts';

function key(init: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

describe('matchShortcut', () => {
  it('maps Ctrl+S to save', () => {
    expect(matchShortcut(key({ key: 's', ctrlKey: true }))).toBe('save');
  });

  it('maps Ctrl+Shift+S to saveAs', () => {
    expect(matchShortcut(key({ key: 'S', ctrlKey: true, shiftKey: true }))).toBe('saveAs');
  });

  it('maps Ctrl+E to cycleView', () => {
    expect(matchShortcut(key({ key: 'e', ctrlKey: true }))).toBe('cycleView');
  });

  it('maps F11 to toggleZen without any modifier', () => {
    expect(matchShortcut(key({ key: 'F11' }))).toBe('toggleZen');
  });

  it('maps Escape to exitZen', () => {
    expect(matchShortcut(key({ key: 'Escape' }))).toBe('exitZen');
  });

  it('maps Ctrl+Tab to nextTab', () => {
    expect(matchShortcut(key({ key: 'Tab', ctrlKey: true }))).toBe('nextTab');
  });

  it('maps Ctrl+Shift+Tab to prevTab', () => {
    expect(matchShortcut(key({ key: 'Tab', ctrlKey: true, shiftKey: true }))).toBe('prevTab');
  });

  it('is case insensitive on the letter', () => {
    expect(matchShortcut(key({ key: 'S', ctrlKey: true }))).toBe('save');
  });

  it('returns null for an unbound combination', () => {
    expect(matchShortcut(key({ key: 'q', ctrlKey: true }))).toBeNull();
  });

  it('returns null for a plain letter so typing is never intercepted', () => {
    expect(matchShortcut(key({ key: 's' }))).toBeNull();
  });

  it('ignores Ctrl+B because the editor owns it', () => {
    expect(matchShortcut(key({ key: 'b', ctrlKey: true }))).toBeNull();
  });
});

describe('registerShortcuts', () => {
  it('calls the matching handler and prevents the default', () => {
    const save = vi.fn();
    const off = registerShortcuts({ save });
    const event = key({ key: 's', ctrlKey: true });
    window.dispatchEvent(event);
    expect(save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    off();
  });

  it('does nothing when no handler is registered for the action', () => {
    const off = registerShortcuts({});
    const event = key({ key: 's', ctrlKey: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    off();
  });

  it('stops listening after the returned function is called', () => {
    const save = vi.fn();
    const off = registerShortcuts({ save });
    off();
    window.dispatchEvent(key({ key: 's', ctrlKey: true }));
    expect(save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/shortcuts.test.ts`
Expected: FAIL, cannot resolve `./shortcuts`.

- [ ] **Step 3: Implement shortcuts.ts**

```ts
const BINDINGS: Record<string, string> = {
  'ctrl+n': 'new',
  'ctrl+o': 'open',
  'ctrl+shift+o': 'openFolder',
  'ctrl+s': 'save',
  'ctrl+shift+s': 'saveAs',
  'ctrl+w': 'close',
  'ctrl+e': 'cycleView',
  'ctrl+shift+e': 'toggleFiles',
  'ctrl+shift+u': 'toggleOutline',
  'ctrl+,': 'settings',
  'ctrl+tab': 'nextTab',
  'ctrl+shift+tab': 'prevTab',
  'ctrl+shift+h': 'exportHtml',
  'ctrl+p': 'print',
  f11: 'toggleZen',
  escape: 'exitZen',
};

function comboOf(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.shiftKey) parts.push('shift');
  if (event.altKey) parts.push('alt');
  parts.push(event.key.toLowerCase());
  return parts.join('+');
}

export function matchShortcut(event: KeyboardEvent): string | null {
  return BINDINGS[comboOf(event)] ?? null;
}

export function registerShortcuts(handlers: Record<string, () => void>): () => void {
  function onKeyDown(event: KeyboardEvent): void {
    const action = matchShortcut(event);
    if (action === null) return;
    const handler = handlers[action];
    if (!handler) return;
    event.preventDefault();
    event.stopPropagation();
    handler();
  }
  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
```

`Ctrl+F` and `Ctrl+H` are absent on purpose: CodeMirror's search panel owns them inside the editor, and the capture-phase listener here would steal them.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/shortcuts.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Wire the handlers in App.svelte**

```ts
onMount(() => {
  const off = registerShortcuts({
    new: () => documents.create(),
    open: () => void openFileFlow(),
    openFolder: () => void openFolderFlow(),
    save: () => void saveFlow(),
    saveAs: () => void saveAsFlow(),
    close: () => void closeActiveFlow(),
    cycleView: () => ui.cycleViewMode(),
    toggleFiles: () => ui.toggleSidebar('files'),
    toggleOutline: () => ui.toggleSidebar('outline'),
    toggleZen: () => ui.toggleZen(),
    exitZen: () => {
      if (ui.zen) ui.zen = false;
    },
    settings: () => (ui.settingsOpen = true),
    nextTab: () => cycleTab(1),
    prevTab: () => cycleTab(-1),
    exportHtml: () => void exportHtmlFlow(),
    print: () => printPreview(),
  });
  return off;
});
```

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat(app): global keyboard shortcuts"
```

---

### Task 18: Export to HTML and print to PDF

**Files:**
- Create: `src/lib/export/html.ts`, `src/lib/export/print.ts`, `src/lib/ui/print.css`
- Test: `src/lib/export/html.test.ts`

**Interfaces:**
- Consumes: `renderMarkdown` (Task 8), `resolveRelative` (Task 6).
- Produces:
  - `buildStandaloneHtml(options: { title: string; bodyHtml: string; css: string; theme: 'light' | 'dark' }): string`
  - `collectStyles(): string` reading the app's own stylesheets
  - `inlineImages(html: string, docPath: string | null): Promise<string>`
  - `exportHtml(doc: { title: string; text: string; path: string | null }, targetPath: string): Promise<void>`
  - `printPreview(): void`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildStandaloneHtml } from './html';

const base = { title: 'Mi nota', bodyHtml: '<h1>Hola</h1>', css: 'body{color:red}', theme: 'light' as const };

describe('buildStandaloneHtml', () => {
  it('produces a complete document', () => {
    const html = buildStandaloneHtml(base);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('</html>');
  });

  it('uses the document title', () => {
    expect(buildStandaloneHtml(base)).toContain('<title>Mi nota</title>');
  });

  it('escapes the title', () => {
    const html = buildStandaloneHtml({ ...base, title: '<script>x</script>' });
    expect(html).not.toContain('<title><script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('inlines the stylesheet', () => {
    expect(buildStandaloneHtml(base)).toContain('body{color:red}');
  });

  it('includes the rendered body', () => {
    expect(buildStandaloneHtml(base)).toContain('<h1>Hola</h1>');
  });

  it('carries no script tags', () => {
    expect(buildStandaloneHtml(base)).not.toContain('<script');
  });

  it('sets the theme attribute on the root element', () => {
    expect(buildStandaloneHtml({ ...base, theme: 'dark' })).toContain('data-theme="dark"');
  });

  it('declares utf-8', () => {
    expect(buildStandaloneHtml(base)).toContain('charset="utf-8"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/export/html.test.ts`
Expected: FAIL, cannot resolve `./html`.

- [ ] **Step 3: Implement html.ts**

```ts
import { writeText } from '$lib/fs/api';
import { resolveRelative } from '$lib/fs/paths';
import { renderMarkdown } from '$lib/preview/render';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface StandaloneOptions {
  title: string;
  bodyHtml: string;
  css: string;
  theme: 'light' | 'dark';
}

export function buildStandaloneHtml(options: StandaloneOptions): string {
  return [
    '<!doctype html>',
    `<html lang="es" data-theme="${options.theme}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(options.title)}</title>`,
    `<style>${options.css}</style>`,
    '</head>',
    '<body class="markdown-body">',
    options.bodyHtml,
    '</body>',
    '</html>',
  ].join('\n');
}

export function collectStyles(): string {
  const sheets = Array.from(document.styleSheets);
  const chunks: string[] = [];
  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText);
    } catch {
      continue;
    }
  }
  return chunks.join('\n');
}

async function fileToDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function inlineImages(html: string, docPath: string | null): Promise<string> {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const images = Array.from(holder.querySelectorAll('img'));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') ?? '';
      if (src.length === 0 || src.startsWith('data:')) return;
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const url = /^https?:/i.test(src) ? src : convertFileSrc(docPath ? resolveRelative(docPath, src) : src);
      const data = await fileToDataUri(url);
      if (data) img.setAttribute('src', data);
    }),
  );
  return holder.innerHTML;
}

export async function exportHtml(
  doc: { title: string; text: string; path: string | null },
  targetPath: string,
  theme: 'light' | 'dark',
): Promise<void> {
  const rendered = renderMarkdown(doc.text);
  const bodyHtml = await inlineImages(rendered, doc.path);
  const html = buildStandaloneHtml({ title: doc.title, bodyHtml, css: collectStyles(), theme });
  await writeText(targetPath, html, 'lf');
}
```

Exported HTML keeps whatever KaTeX and Mermaid produced only if the preview has already rendered them; `renderMarkdown` alone returns the raw markup. For an export that matches what the user sees, pass the live preview node's `innerHTML` instead of re-rendering. `exportHtml` therefore takes an optional fourth argument `liveHtml?: string` and uses it when present:

```ts
const rendered = liveHtml ?? renderMarkdown(doc.text);
```

`App.svelte` passes the preview element's `innerHTML` when the preview is mounted.

- [ ] **Step 4: Implement print.ts and print.css**

```ts
export function printPreview(): void {
  window.print();
}
```

`print.css`, imported from `App.svelte`:

```css
@media print {
  .titlebar,
  .sidebar,
  .statusbar,
  .toasts,
  .divider,
  .editor {
    display: none !important;
  }

  .app,
  .body,
  main,
  .preview {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }

  .preview .content {
    max-width: none !important;
    padding: 0 !important;
  }

  :root {
    --bg: #ffffff;
    --bg-elevated: #ffffff;
    --bg-inset: #f5f5f5;
    --text: #000000;
    --text-muted: #444444;
    --border: #cccccc;
  }

  pre,
  blockquote,
  table,
  img {
    break-inside: avoid;
  }

  h1,
  h2,
  h3 {
    break-after: avoid;
  }

  a::after {
    content: ' (' attr(href) ')';
    font-size: 0.85em;
    color: #555555;
  }

  a[href^='#']::after {
    content: '';
  }
}
```

Before printing, the app switches to the preview-only view mode so the layout matches the print sheet, prints, then restores the previous mode.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/lib/export/html.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Verify by hand**

Run: `npm run tauri dev`, open a document with an image, a table, a code block and a formula, export to HTML, open the result in a browser and confirm it looks right offline. Then export to PDF through the print dialog.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat(export): standalone HTML export and print to PDF"
```

---

### Task 19: File drag and drop, image paste and folder opening

**Files:**
- Modify: `src/App.svelte`, `src/lib/editor/create.ts`, `src-tauri/src/commands/fs.rs`, `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/commands/assets.rs`
- Test: `src-tauri/src/commands/assets.rs` unit tests

**Interfaces:**
- Produces:
  - `#[tauri::command] async fn save_asset(doc_path: String, file_name: String, bytes: Vec<u8>) -> Result<String, AppError>` returning the relative markdown path (`assets/name.png`)
  - `uniqueAssetName(existing: &[String], desired: &str) -> String` (pure, tested)
  - Frontend: dropping a `.md` file on the window opens it; dropping an image inserts it; pasting an image from the clipboard inserts it.

- [ ] **Step 1: Write the failing tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_name_when_it_is_free() {
        assert_eq!(unique_asset_name(&[], "a.png"), "a.png");
    }

    #[test]
    fn appends_a_counter_when_taken() {
        assert_eq!(unique_asset_name(&["a.png".into()], "a.png"), "a-1.png");
    }

    #[test]
    fn skips_over_several_collisions() {
        let existing = vec!["a.png".to_string(), "a-1.png".to_string()];
        assert_eq!(unique_asset_name(&existing, "a.png"), "a-2.png");
    }

    #[test]
    fn sanitises_path_separators_and_traversal() {
        assert_eq!(unique_asset_name(&[], "../../evil.png"), "evil.png");
        assert_eq!(unique_asset_name(&[], "sub/dir/x.png"), "x.png");
    }

    #[test]
    fn handles_a_name_without_an_extension() {
        assert_eq!(unique_asset_name(&["captura".into()], "captura"), "captura-1");
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd src-tauri && cargo test unique_asset 2>&1 | tail -5`
Expected: compile error, `unique_asset_name` not found.

- [ ] **Step 3: Implement assets.rs**

```rust
use crate::error::{AppError, AppResult, ErrorKind};
use std::fs;
use std::path::{Path, PathBuf};

pub fn unique_asset_name(existing: &[String], desired: &str) -> String {
    let cleaned = desired.replace('\\', "/");
    let base_name = cleaned.rsplit('/').next().unwrap_or("archivo").trim();
    let base_name = if base_name.is_empty() || base_name == ".." { "archivo" } else { base_name };
    if !existing.iter().any(|e| e == base_name) {
        return base_name.to_string();
    }
    let (stem, ext) = match base_name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (base_name.to_string(), String::new()),
    };
    let mut n = 1;
    loop {
        let candidate = format!("{stem}-{n}{ext}");
        if !existing.iter().any(|e| *e == candidate) {
            return candidate;
        }
        n += 1;
    }
}

fn existing_names(dir: &Path) -> Vec<String> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn save_asset(doc_path: String, file_name: String, bytes: Vec<u8>) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let doc = PathBuf::from(&doc_path);
        let parent = doc.parent().ok_or_else(|| {
            AppError::new(ErrorKind::InvalidPath, "El documento no tiene carpeta").with_path(&doc_path)
        })?;
        let assets = parent.join("assets");
        fs::create_dir_all(&assets).map_err(|e| AppError::from_io(e, &assets.to_string_lossy()))?;
        let name = unique_asset_name(&existing_names(&assets), &file_name);
        let target = assets.join(&name);
        fs::write(&target, &bytes).map_err(|e| AppError::from_io(e, &target.to_string_lossy()))?;
        Ok(format!("assets/{name}"))
    })
    .await
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}
```

Register `pub mod assets;` and `commands::assets::save_asset`.

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Wire drag and drop in App.svelte**

```ts
import { getCurrentWebview } from '@tauri-apps/api/webview';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'];

onMount(() => {
  const unlisten = getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== 'drop') return;
    for (const path of event.payload.paths) {
      const ext = extname(path);
      if (['md', 'markdown', 'txt'].includes(ext)) {
        await openDocument(path);
      } else if (IMAGE_EXTENSIONS.includes(ext)) {
        await insertDroppedImage(path);
      }
    }
  });
  return () => void unlisten.then((off) => off());
});
```

`insertDroppedImage` reads the file through a new Rust command `read_bytes(path) -> Vec<u8>`, calls `save_asset`, and inserts `![name](assets/name.ext)` at the cursor of the active editor. When the active document has no path, it shows a toast asking the user to save first.

Add `read_bytes` next to `read_text` in `fs.rs`:

```rust
#[tauri::command]
pub async fn read_bytes(path: String) -> AppResult<Vec<u8>> {
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::read(&path).map_err(|e| AppError::from_io(e, &path))
    })
    .await
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}
```

Clipboard paste: a `paste` listener on the editor host reads `event.clipboardData.items`, and for any item whose `type` starts with `image/` converts the blob to bytes and follows the same path with the name `pegado-<timestamp>.png`.

Pasting a URL over a selection wraps it as a link. That is a CodeMirror `EditorView.domEventHandlers({ paste })` handler in `create.ts` that returns `false` when the clipboard text is not a URL:

```ts
paste(event, view) {
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (!/^https?:\/\/\S+$/.test(text)) return false;
  const range = view.state.selection.main;
  if (range.empty) return false;
  event.preventDefault();
  insertLink(view, text);
  return true;
}
```

- [ ] **Step 6: Add the dialog flows**

`openFileFlow` uses `open({ multiple: true, filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] })`. `openFolderFlow` uses `open({ directory: true })`, sets `ui.folder`, persists `prefs.update({ lastFolder: folder })` and switches the sidebar to files. `saveAsFlow` uses `save({ defaultPath, filters })`.

- [ ] **Step 7: Verify by hand and commit**

Run `npm run tauri dev`, drag a markdown file onto the window, drag a PNG into the editor, paste an image from the clipboard, and paste a URL over selected text.

```bash
git add src src-tauri
git commit -m "feat(app): drag and drop, image paste and folder opening"
```

---

### Task 20: Windows integration, installer and performance measurement

**Files:**
- Create: `scripts/perf.ps1`, `docs/perf.md`, `docs/smoke.md`, `README.md`
- Modify: `src-tauri/tauri.conf.json`, `package.json`

**Interfaces:**
- Produces: a signed-less NSIS installer under `src-tauri/target/release/bundle/nsis/`, a measured `docs/perf.md`, and a manual smoke checklist.

- [ ] **Step 1: Add the release scripts**

```bash
npm pkg set scripts.build:app="tauri build"
npm pkg set scripts.perf="powershell -ExecutionPolicy Bypass -File scripts/perf.ps1"
```

- [ ] **Step 2: Write scripts/perf.ps1**

```powershell
param(
    [string]$Exe = "src-tauri/target/release/Reader.exe",
    [string]$Out = "docs/perf.md"
)

$ErrorActionPreference = "Stop"

function New-Fixture {
    param([string]$Path, [int]$Kilobytes)
    $block = @"
# Sección

Texto de prueba con **negrita**, *cursiva* y ``código``.

- uno
- dos
- tres

| a | b |
| - | - |
| 1 | 2 |

"@
    $sb = [System.Text.StringBuilder]::new()
    while ($sb.Length -lt $Kilobytes * 1024) { [void]$sb.Append($block) }
    Set-Content -Path $Path -Value $sb.ToString() -Encoding utf8
}

$fixtures = "tests/fixtures"
if (-not (Test-Path $fixtures)) { New-Item -ItemType Directory -Force $fixtures | Out-Null }
New-Fixture -Path "$fixtures/small.md" -Kilobytes 100
New-Fixture -Path "$fixtures/large.md" -Kilobytes 5120

function Measure-Startup {
    param([string]$File)
    $samples = @()
    foreach ($i in 1..5) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $p = Start-Process -FilePath $Exe -ArgumentList $File -PassThru
        $p.WaitForInputIdle(20000) | Out-Null
        $sw.Stop()
        $samples += $sw.ElapsedMilliseconds
        Start-Sleep -Milliseconds 1500
        $mem = (Get-Process -Id $p.Id).WorkingSet64
        $children = Get-Process | Where-Object { $_.ProcessName -like "msedgewebview2*" }
        foreach ($c in $children) { $mem += $c.WorkingSet64 }
        Stop-Process -Id $p.Id -Force
        Start-Sleep -Milliseconds 500
        $script:lastMemoryMb = [math]::Round($mem / 1MB, 1)
    }
    [pscustomobject]@{
        MedianMs = ($samples | Sort-Object)[[int]($samples.Count / 2)]
        MemoryMb = $script:lastMemoryMb
    }
}

$small = Measure-Startup -File "$fixtures/small.md"
$large = Measure-Startup -File "$fixtures/large.md"

$installer = Get-ChildItem "src-tauri/target/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1
$installerMb = if ($installer) { [math]::Round($installer.Length / 1MB, 1) } else { "n/d" }

$report = @"
# Rendimiento

Medido el $(Get-Date -Format 'yyyy-MM-dd HH:mm') en $($env:COMPUTERNAME).

| Métrica | Presupuesto | Medido |
|---|---|---|
| Arranque con documento de 100 KB | < 600 ms | $($small.MedianMs) ms |
| RAM con documento de 100 KB | < 70 MB | $($small.MemoryMb) MB |
| Arranque con documento de 5 MB | < 800 ms | $($large.MedianMs) ms |
| RAM con documento de 5 MB | sin presupuesto | $($large.MemoryMb) MB |
| Instalador | < 15 MB | $installerMb MB |

Mediana de cinco arranques en frío. La memoria suma el proceso principal y los procesos de WebView2.
"@

Set-Content -Path $Out -Value $report -Encoding utf8
Write-Output $report
```

- [ ] **Step 3: Build the release bundle**

Run: `npm run build:app`
Expected: `src-tauri/target/release/bundle/nsis/Reader_0.1.0_x64-setup.exe` exists.

- [ ] **Step 4: Measure and record**

Run: `npm run perf`
Expected: `docs/perf.md` written with real numbers.

If any budget is exceeded, do not tune blindly. Open the built app, use WebView2 DevTools (`Ctrl+Shift+I` in a debug build) and check in this order: the size of the entry chunk, whether KaTeX or Mermaid are in it, the time spent in `renderMarkdown` versus `patchPreview`, and the number of DOM nodes in the preview. Fix the largest contributor, then re-measure.

- [ ] **Step 5: Write docs/smoke.md**

A checklist to run before each release:

1. Double-click a `.md` file in Explorer. It opens in Reader, in a new tab if Reader is already running.
2. Open a second file from the command line with `Reader.exe path`. It reuses the running window.
3. Drag a markdown file onto the window. It opens.
4. Drag a PNG into the editor. It lands in `assets/` and the image shows in the preview.
5. Edit a document, switch to another app, come back. Autosave behaved as configured.
6. Edit a file, change it in Notepad, save there. The reload bar offers both options and both work.
7. Delete the open file from Explorer. The document detaches with a warning and the text survives.
8. Close a tab with unsaved changes. The dialog offers save, discard and cancel, and each works.
9. Close the window with two dirty documents. It asks once per document.
10. Toggle the Windows theme. The app follows when the theme preference is "system".
11. Open a document with a formula, a Mermaid diagram and a code block. All three render.
12. Export to HTML. The file opens correctly in a browser with no network.
13. Export to PDF through the print dialog.
14. Zen mode with F11, exit with Escape.
15. Resize the window to 640×400. Nothing overlaps and nothing scrolls horizontally.

- [ ] **Step 6: Write README.md**

Short: what Reader is, a screenshot, how to develop (`npm install`, `npm run tauri dev`), how to build (`npm run build:app`), the shortcut table, and the phase roadmap pointing at the spec.

- [ ] **Step 7: Run everything one last time**

```bash
npm test
npm run check
cd src-tauri && cargo test && cargo clippy -- -D warnings
```

Expected: all green. Fix any clippy warning rather than allowing it.

- [ ] **Step 8: Commit and tag**

```bash
git add -A
git commit -m "chore: release scripts, performance measurement and documentation"
git tag v0.1.0
```

---

## Self-review notes

**Spec coverage.** Every section of the spec maps to a task: §4.4 commands to Tasks 2-5, §4.3 state to Tasks 7 and 14, §4.5 and §4.7 preview to Tasks 8-10, §4.6 scroll sync to Task 13, §4.8 editor to Tasks 11-12, §4.9 view modes and §4.11-4.12 sidebar and status bar to Task 16, §4.10 files and saving to Tasks 14 and 19, §4.13 export to Task 18, §4.14 theme to Task 7, §4.15 language to Task 7, §5 error handling across Tasks 2, 6 and 14, §6 security to Tasks 1, 5 and 8, §7 testing throughout, §3 budgets measured in Task 20.

**Known corrections carried forward.** Task 14 moves `ReaderError` and the shared types out of `api.ts` into `api-types.ts` so tests can mock the bridge; apply that split when you reach Task 14 rather than at Task 6, or do it early at Task 6 if you prefer. `tempfile` must be a normal dependency, not a dev-dependency, because `write_text_sync` uses it at runtime.
