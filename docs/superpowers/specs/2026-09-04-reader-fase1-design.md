# Reader — Fase 1: esqueleto de la app y lector/editor de Markdown

Fecha: 2026-09-04
Estado: aprobado por Esteban (decisiones delegadas a partir del enfoque A)

## 1. Objetivo

Reader es un lector y editor de escritorio para Markdown y PDF que compite en ligereza y velocidad. Esta fase entrega la base de la aplicación y el soporte completo de Markdown. Las fases siguientes añaden PDF (visor, anotaciones, páginas, formularios) y después edición de contenido de PDF.

Criterio de éxito de la fase: abrir un `.md` desde el explorador de Windows y estar leyendo o editando en menos de medio segundo, con una vista previa que sigue al cursor sin tirones, y una app que en reposo consume una fracción de lo que consume un Electron equivalente.

## 2. Decisiones ya tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Base | Tauri 2 (Rust + WebView2) | Binario de 5-10 MB y 30-50 MB de RAM frente a 80-100 MB y 150+ MB de Electron |
| UI | Svelte 5 + TypeScript + Vite | Compila a JS plano sin runtime pesado |
| Editor | CodeMirror 6 | Virtualiza líneas, aguanta archivos de decenas de MB, modular |
| Parser Markdown | markdown-it en el WebView | Cero latencia tecla→vista previa, ecosistema de plugins |
| Modo de edición | Vista dividida + modo lectura | Predecible, rápido de hacer bien; WYSIWYG descartado |
| Plataforma | Windows 10/11 x64 | Donde se desarrolla y prueba; mac/Linux después |
| Destino | Distribución pública | Instalador NSIS; auto-actualización se difiere a la fase de release |

## 3. Presupuestos de rendimiento

Son requisitos, no aspiraciones. Se miden al final de la fase y quedan registrados en `docs/perf.md`.

| Métrica | Presupuesto |
|---|---|
| Arranque en frío hasta primer pintado | < 400 ms |
| Arranque hasta documento visible (archivo de 100 KB) | < 600 ms |
| RAM en reposo con un documento abierto | < 70 MB (proceso principal + WebView) |
| Instalador | < 15 MB |
| Abrir un `.md` de 5 MB | < 800 ms hasta editable |
| Latencia tecla → vista previa (doc < 200 KB) | < 32 ms percibidos (un frame y medio) |
| Scroll del editor y de la vista previa | 60 fps en un doc de 5 MB |

Reglas derivadas:

- KaTeX, Mermaid y highlight.js se cargan bajo demanda, solo cuando el documento los necesita. El bundle inicial no los incluye.
- La vista previa nunca hace `innerHTML = html` del documento entero. Se parchea el DOM (morphdom) para que solo cambien los nodos afectados.
- Para documentos grandes (> 200 KB) la vista previa se actualiza con debounce de 80 ms; por debajo se actualiza en cada `requestAnimationFrame` tras un cambio.
- Ningún comando de Rust bloquea el hilo principal de Tauri: lectura, escritura y escaneo de carpetas van en `spawn_blocking` o async.

## 4. Arquitectura

### 4.1 Vista general

```
┌────────────────────────── Ventana Tauri ──────────────────────────┐
│  Rust (src-tauri)                 │  WebView2 (src)                │
│                                   │                                │
│  comandos:                        │  Svelte 5 app                  │
│   fs::read_text, write_text       │   ├─ estado (stores)           │
│   fs::list_dir, fs::exists        │   ├─ editor (CodeMirror 6)     │
│   watcher::watch, unwatch ──eventos──▶├─ preview (markdown-it)     │
│   prefs::get, set                 │   ├─ fs (wrappers de invoke)   │
│   recent::list, push              │   └─ ui (componentes)          │
│   shell::open_external            │                                │
│                                   │                                │
│  plugins: dialog, window-state,   │                                │
│           single-instance, cli    │                                │
└───────────────────────────────────┴────────────────────────────────┘
```

El WebView es dueño del estado del documento y de todo lo visual. Rust es un servicio de sistema de archivos y preferencias sin estado propio salvo el registro de watchers activos.

### 4.2 Estructura de carpetas

```
Reader/
  package.json
  vite.config.ts
  svelte.config.js
  tsconfig.json
  index.html
  src/
    main.ts                      arranque de Svelte
    App.svelte                   layout raíz
    app.css                      tokens de tema y reset
    lib/
      state/
        documents.ts             documentos abiertos, pestaña activa, dirty
        ui.ts                    modo de vista, paneles visibles, zen
        prefs.ts                 preferencias persistidas
        recent.ts                archivos recientes
      fs/
        api.ts                   wrappers tipados de invoke()
        events.ts                suscripción a eventos de watcher
        paths.ts                 utilidades de rutas (dirname, join, es-md)
      editor/
        create.ts                fábrica de EditorView con extensiones
        keymap.ts                atajos de formato
        commands.ts              negrita, cursiva, título, enlace, lista, código
        markdown-lang.ts         lenguaje markdown + resaltado
        theme.ts                 tema claro/oscuro de CodeMirror
      preview/
        pipeline.ts              instancia markdown-it y plugins base
        render.ts                texto → HTML con data-line
        patch.ts                 parcheo DOM incremental
        lazy.ts                  carga bajo demanda de katex, mermaid, hljs
        scroll-sync.ts           mapa línea↔offset y sincronización bidireccional
        outline.ts               extracción de títulos para el panel de esquema
        links.ts                 resolución de imágenes relativas y enlaces externos
      export/
        html.ts                  HTML autónomo con estilos incrustados
        print.ts                 exportar a PDF vía diálogo de impresión
      ui/
        TitleBar.svelte          barra propia con menú, pestañas y controles de ventana
        Tabs.svelte
        Sidebar.svelte           contenedor de FileTree y Outline
        FileTree.svelte
        Outline.svelte
        Editor.svelte
        Preview.svelte
        SplitPane.svelte         divisor arrastrable
        StatusBar.svelte
        Settings.svelte          diálogo de preferencias
        Welcome.svelte           pantalla sin documentos: recientes y abrir
        Dialog.svelte            confirmaciones (guardar cambios, recargar)
      shortcuts.ts               tabla global de atajos
      i18n.ts                    cadenas de la UI (es, en)
  src-tauri/
    Cargo.toml
    tauri.conf.json
    capabilities/default.json
    src/
      main.rs
      lib.rs                     registro de comandos y plugins
      commands/
        fs.rs
        watcher.rs
        prefs.rs
        recent.rs
        shell.rs
      error.rs                   tipo de error serializable
  docs/
    superpowers/specs/
    superpowers/plans/
    perf.md                      mediciones de los presupuestos
  tests/                         fixtures markdown para pruebas
```

### 4.3 Estado en el WebView

Cuatro stores de Svelte 5 (runes en módulos `.svelte.ts`):

- **documents**: lista de `Document { id, path | null, title, text, savedText, language: 'markdown', cursor, scroll }` y `activeId`. `dirty` se deriva de `text !== savedText`. El texto vive en el `EditorState` de CodeMirror; el store guarda una referencia al `EditorView` por documento para no duplicar el buffer.
- **ui**: `viewMode: 'split' | 'editor' | 'preview'`, `sidebar: 'files' | 'outline' | null`, `zen: boolean`, `splitRatio`.
- **prefs**: `theme: 'system' | 'light' | 'dark'`, `editorFont`, `editorFontSize`, `previewFont`, `previewWidth`, `tabSize`, `wordWrap`, `autosave: 'off' | 'afterDelay' | 'onFocusChange'`, `autosaveDelayMs`, `language: 'es' | 'en'`. Se lee de Rust al arrancar y se escribe con debounce al cambiar.
- **recent**: hasta 20 rutas con marca de tiempo, persistidas por Rust.

Cada documento tiene su propio `EditorState`; un único `EditorView` montado recibe el estado del documento activo al cambiar de pestaña. Los `EditorState` de pestañas inactivas se conservan en memoria.

### 4.4 Comandos Rust

Todos devuelven `Result<T, AppError>` donde `AppError` serializa a `{ kind, message, path? }`. `kind` es uno de `NotFound | PermissionDenied | NotUtf8 | Io | InvalidPath`.

| Comando | Firma | Notas |
|---|---|---|
| `read_text` | `(path) -> { text, modified_ms }` | Detecta BOM, normaliza CRLF a LF, devuelve el `line_ending` original para respetarlo al guardar |
| `write_text` | `(path, text, line_ending)` | Escritura atómica: escribe a `path.tmp` y renombra |
| `list_dir` | `(path, depth) -> [Entry { name, path, is_dir, children? }]` | Ignora `node_modules`, `.git`, `target`; profundidad máxima 4; solo muestra `.md`, `.markdown`, `.txt` y carpetas |
| `exists` | `(path) -> bool` | |
| `watch` | `(path) -> ()` | Registra un watcher `notify` con debounce de 200 ms; emite `fs:changed { path, kind }` |
| `unwatch` | `(path)` | |
| `get_prefs` / `set_prefs` | JSON en `%APPDATA%/Reader/prefs.json` | |
| `get_recent` / `push_recent` | JSON en `%APPDATA%/Reader/recent.json` | |
| `open_external` | `(url)` | Solo `http`, `https`, `mailto` |
| `resolve_asset` | `(doc_path, relative) -> asset_url` | Convierte rutas relativas de imágenes al esquema `asset://` de Tauri |

El `single-instance` reenvía los argumentos de una segunda invocación a la ventana existente, que los abre como pestañas nuevas. El plugin `cli` entrega las rutas pasadas al ejecutable en el primer arranque.

### 4.5 Flujo de datos del editor a la vista previa

```
tecla → CodeMirror EditorView.update
      → documents.text (efecto)
      → programar render (rAF o debounce 80 ms según tamaño)
      → render.ts: markdown-it.render(text) con data-line en bloques
      → patch.ts: morphdom(previewRoot, nuevoHTML)
      → lazy.ts: si hay .katex/.mermaid/pre code pendientes, cargar y procesar
      → scroll-sync: reconstruir mapa línea → offsetTop de los bloques con data-line
```

`markdown-it` se configura con `html: true` pero el HTML se pasa por DOMPurify antes de tocar el DOM. Las etiquetas `<script>` y los manejadores `on*` nunca llegan a la vista previa.

### 4.6 Scroll sincronizado

Cada bloque de nivel superior del HTML lleva `data-line="inicio-fin"` obtenido del `map` de los tokens de markdown-it. Al hacer scroll en el editor se toma la línea del primer píxel visible, se busca el bloque cuyo rango la contiene y se interpola su `offsetTop` proporcionalmente dentro del rango. En sentido inverso se toma el bloque visible en la vista previa y se pide a CodeMirror la posición vertical de esa línea. Un flag evita la retroalimentación: el panel que originó el scroll ignora el eco durante 100 ms.

### 4.7 Vista previa: pipeline de markdown-it

Base: `markdown-it` con `linkify`, `typographer` desactivado (cambia comillas de forma sorprendente), `breaks: false`.

Plugins siempre cargados (son pequeños): `markdown-it-task-lists`, `markdown-it-footnote`, `markdown-it-anchor` (ids de títulos).

Bajo demanda:

- **Código**: `highlight.js` core + gramática del lenguaje detectado. Se carga cuando aparece el primer bloque de código con lenguaje. Sin lenguaje se muestra en monoespaciada sin resaltar.
- **Matemáticas**: `markdown-it-katex` + CSS de KaTeX cuando el texto contiene `$`.
- **Diagramas**: `mermaid` cuando hay un bloque ` ```mermaid `. Se renderiza a SVG en un worker de la propia librería; los errores de sintaxis se muestran dentro del bloque sin romper el resto.

Imágenes: `src` relativo se resuelve respecto a la carpeta del documento y se sirve por `asset://`. Enlaces `http(s)` abren el navegador del sistema. Enlaces a otros `.md` relativos abren una pestaña nueva.

### 4.8 Editor

CodeMirror 6 con:

- `@codemirror/lang-markdown` con GFM y resaltado de código anidado por lenguaje.
- Ajuste de línea (activable), números de línea (activable), resaltado de línea activa, cierre de paréntesis y corchetes, historial, búsqueda y reemplazo (`Ctrl+F`, `Ctrl+H`), autocompletado desactivado.
- Comandos de formato: negrita `Ctrl+B`, cursiva `Ctrl+I`, código en línea `` Ctrl+` ``, enlace `Ctrl+K`, título `Ctrl+1..6`, lista `Ctrl+Shift+L`, tarea `Ctrl+Shift+T`, cita `Ctrl+Shift+Q`. Todos envuelven la selección o insertan un marcador vacío y colocan el cursor dentro.
- Continuación automática de listas y tareas al pulsar Enter; una lista vacía y Enter la cierra.
- Tab en una línea de lista aumenta la sangría; Shift+Tab la reduce.
- Pegar una URL con texto seleccionado crea un enlace.
- Arrastrar una imagen al editor copia el archivo a `./assets/` junto al documento e inserta `![nombre](assets/nombre.png)`.

### 4.9 Modos de vista

- **Dividido**: editor a la izquierda, vista previa a la derecha, divisor arrastrable, proporción persistida.
- **Solo editor** y **solo vista previa** (modo lectura). En modo lectura la vista previa se centra en una columna de anchura configurable con tipografía de lectura.
- **Zen**: `F11` oculta barra de título, pestañas, barra lateral y barra de estado; se sale con `Esc` o `F11`.
- Ciclo con `Ctrl+E` (editor → dividido → vista previa).

### 4.10 Archivos, pestañas y guardado

- Abrir con `Ctrl+O`, arrastrando al área de trabajo, desde el árbol de archivos, desde recientes, por argumento de línea de comandos o asociación de `.md` en Windows.
- `Ctrl+N` crea un documento sin ruta; al guardar pide ruta.
- `Ctrl+S` guarda; `Ctrl+Shift+S` guarda como. La escritura respeta el final de línea original del archivo.
- Autoguardado según preferencia. Con `afterDelay` se guarda 1 s después del último cambio; con `onFocusChange` al perder foco la ventana o cambiar de pestaña.
- Cerrar una pestaña con cambios sin guardar pide confirmación: guardar, descartar, cancelar. Cerrar la ventana repite la pregunta por cada documento sucio.
- Cambios externos: si el archivo cambia en disco y el documento no está sucio, se recarga en silencio conservando cursor y scroll. Si está sucio, una barra no modal ofrece "Recargar" o "Conservar mis cambios".
- Si el archivo se borra en disco, el documento pasa a "sin ruta" con aviso y se conserva el texto.

### 4.11 Barra lateral

- **Archivos**: árbol de la carpeta abierta (`Ctrl+Shift+O` o al abrir un archivo se ofrece abrir su carpeta). Clic abre en la pestaña activa si no está sucia y no está fijada; doble clic abre en pestaña nueva. Se actualiza con el watcher de la carpeta.
- **Esquema**: títulos del documento activo con sangría por nivel; clic desplaza el editor y la vista previa; se resalta el título en el que está el cursor.

### 4.12 Barra de estado

Palabras, caracteres, tiempo de lectura estimado (200 ppm), línea:columna, final de línea (LF/CRLF), modo de vista, indicador de autoguardado. Clic en el final de línea permite cambiarlo.

### 4.13 Exportación

- **HTML**: documento autónomo con el CSS de la vista previa incrustado, imágenes convertidas a `data:` URIs, KaTeX y highlight ya renderizados en el HTML. Sin JavaScript.
- **PDF**: abre el diálogo de impresión de WebView2 sobre la vista previa con una hoja de estilos `@media print` que oculta la interfaz. El usuario elige "Guardar como PDF". No se usa ningún motor propio.

### 4.14 Tema y apariencia

Tokens CSS en `app.css` para claro y oscuro. `theme: system` sigue `prefers-color-scheme` y también el tema de la ventana de Tauri para la barra de título propia. La ventana usa `decorations: false` y una barra de título propia con arrastre (`data-tauri-drag-region`), botones minimizar, maximizar y cerrar, y el menú de la app en un botón. Esto ahorra el menú nativo y da una apariencia coherente en ambos temas.

Tipografía por defecto: editor en `Cascadia Code, Consolas, monospace`; vista previa en `Segoe UI Variable, Segoe UI, system-ui`. Ambas configurables.

### 4.15 Idioma

Interfaz en español por defecto con inglés disponible. Las cadenas viven en `i18n.ts` como un objeto por idioma; sin librería.

## 5. Manejo de errores

- Toda llamada a `invoke` pasa por `fs/api.ts`, que convierte `AppError` en un `ReaderError` tipado. La UI muestra errores en una notificación no modal en la esquina inferior derecha que desaparece a los 6 s; los errores de guardado no desaparecen hasta que se cierran.
- Archivo no UTF-8: se abre en solo lectura con aviso "Codificación no compatible".
- Archivo mayor de 20 MB: se abre en modo solo editor con vista previa desactivada y aviso; el usuario puede activarla a mano.
- Fallo al cargar KaTeX o Mermaid: el bloque muestra el código fuente con un borde de aviso.
- Pérdida de permisos al guardar: se ofrece "Guardar como".
- Pánico en Rust: los comandos usan `Result`, nunca `unwrap` sobre entrada del usuario; `tauri::Builder` registra un hook de pánico que escribe a `%APPDATA%/Reader/logs/`.

## 6. Seguridad

- CSP estricta en `tauri.conf.json`: `default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:`. `unsafe-inline` en estilos es necesario por KaTeX y Mermaid.
- `asset://` limitado con `assetProtocol.scope` a la carpeta de los documentos abiertos, añadida dinámicamente.
- Capabilities de Tauri mínimas: solo los comandos propios y `dialog`, `window-state`, `single-instance`, `cli`.
- DOMPurify sobre todo HTML generado antes de parchear.

## 7. Pruebas

- **Unitarias TS (Vitest)**: pipeline de markdown (fixtures en `tests/fixtures/*.md` con HTML esperado), `scroll-sync` (mapa línea→bloque con casos límite: líneas en blanco, bloques anidados, final de documento), comandos de formato del editor (estado antes/después con `EditorState`), `outline.ts`, `paths.ts`, `export/html.ts` (imágenes a `data:`), stores (dirty, cierre con confirmación).
- **Unitarias Rust (`cargo test`)**: `read_text` con BOM, CRLF, no UTF-8; `write_text` atómico; `list_dir` con filtros y profundidad; `prefs` y `recent` con archivos corruptos (deben regenerarse, no fallar).
- **Componentes (Vitest + jsdom + @testing-library/svelte)**: `Tabs`, `Outline`, `StatusBar`, `Dialog` de cierre.
- **Humo manual documentado** en `docs/smoke.md`: lista corta de comprobaciones antes de cada release (abrir desde explorador, arrastrar, cambio externo, exportar, zen).
- **Rendimiento**: script `scripts/perf.ps1` que mide arranque y RAM con un documento de 100 KB y otro de 5 MB, y escribe los resultados en `docs/perf.md`.

## 8. Fuera de alcance de esta fase

- PDF en cualquier forma (Fases 2 y 3).
- WYSIWYG.
- Auto-actualización y firma de código (fase de release).
- macOS y Linux.
- Sincronización en la nube, plugins de terceros, temas personalizados más allá de claro/oscuro.
- Búsqueda en toda la carpeta (candidata a Fase 2 junto con la barra lateral de PDF).
- Paleta de comandos.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| morphdom se traba con documentos enormes | Umbral de 20 MB desactiva la vista previa. Si la medición de `scripts/perf.ps1` muestra tirones por debajo de ese umbral, se virtualiza la vista previa por secciones en una iteración posterior |
| Mermaid pesa 2 MB+ | Carga bajo demanda y solo se importa una vez; el usuario que no usa diagramas nunca lo paga |
| WebView2 ausente en máquinas antiguas | El instalador NSIS incluye el bootstrapper de WebView2 (`webviewInstallMode: downloadBootstrapper`) |
| Asociación de archivos y `single-instance` en Windows | Se prueba en la lista de humo; el plugin `cli` se configura para aceptar rutas posicionales |
