# Reader Fase 2 (PDF) — plan de implementación

**Spec:** `docs/superpowers/specs/2026-09-06-reader-fase2-pdf-design.md`

**Objetivo:** visor de PDF y anotaciones que se guardan dentro del archivo, sin
que el arranque ni el instalador de la app se resientan para quien solo usa
Markdown.

## Restricciones que valen para todas las tareas

- Sin comentarios en los archivos de código.
- `pdfjs-dist` y `pdf-lib` solo por `import()` dinámico. Se verifica en cada
  compilación que no aparecen en el chunk de entrada.
- El archivo nunca viaja por IPC como texto ni como array de números. Se lee por
  `asset://` y se escribe con un comando que recibe bytes.
- Toda la lógica que se pueda expresar como función pura va en un módulo propio
  con pruebas, no dentro de un componente.
- Las coordenadas de las anotaciones se guardan en el espacio del PDF.
- Cada tarea deja las pruebas en verde antes de pasar a la siguiente.

## Etapa A — cimientos

### Tarea 1: el documento pasa a ser una unión de tipos

**Archivos:** `src/lib/state/documents.svelte.ts`, y todo lo que lee `doc.text`.

**Produce:** `MarkdownDocument`, `PdfDocument`, `Document = MarkdownDocument |
PdfDocument`, con `kind` como discriminante. `documents.isDirty` compara texto
para Markdown y lista de anotaciones para PDF. `documents.openMarkdown` y
`documents.openPdf`, con `documents.open` eligiendo por extensión.

**Pruebas:** las 28 actuales de `documents.test.ts` siguen pasando sin cambios de
comportamiento; se añaden las de apertura de PDF y suciedad por anotaciones.

### Tarea 2: escritura atómica de bytes en Rust

**Archivos:** `src-tauri/src/commands/fs.rs`.

**Produce:** `write_bytes` escribe a un temporal y renombra, como `write_text`.

**Pruebas:** el archivo original no queda a medias si el proceso muere; no deja
temporales; sobrescribe correctamente un archivo más largo.

### Tarea 3: carga perezosa de pdf.js

**Archivos:** `src/lib/pdf/load.ts`, `scripts/sync-pdf-worker.mjs`,
`package.json`.

**Produce:** `loadPdfjs(): Promise<PdfjsModule>` que importa `pdfjs-dist` una sola
vez y apunta el worker al archivo servido desde `public/pdf/`. El script copia el
worker igual que hace `sync-dictionaries.mjs`.

**Verificación:** `npm run build` y comprobar que el chunk de entrada no contiene
pdf.js.

## Etapa B — visor

### Tarea 4: virtualización

**Archivos:** `src/lib/pdf/virtual.ts`.

**Produce:** `visibleRange(heights, scrollTop, viewport, overscan)` que devuelve
la primera y la última página a renderizar y el desplazamiento de cada una.
`totalHeight(heights, gap)`. `pageAtOffset(heights, offset)`.

**Pruebas:** documento vacío; una sola página; scroll en el borde exacto entre
dos páginas; overscan que se sale por arriba y por abajo; páginas de alturas
distintas; scroll más allá del final.

### Tarea 5: abrir y describir un PDF

**Archivos:** `src/lib/pdf/document.ts`.

**Produce:** `openPdf(url): Promise<PdfHandle>` con `pageCount`, `pageSizes`,
`outline`, `getPage`, `destroy`. Detecta cifrado y lo informa.

**Pruebas:** contra PDF generados con pdf-lib en el propio test: número de
páginas, tamaños, índice con dos niveles, archivo que no es un PDF.

### Tarea 6: renderizar una página

**Archivos:** `src/lib/pdf/render.ts`.

**Produce:** `renderPage(page, canvas, scale, rotation)` que cancela un
renderizado anterior si llega otro, y `scaleFor(size, mode, viewport)` para
ajustar al ancho o a la página.

**Pruebas:** `scaleFor` es pura y se prueba entera; el cancelado se prueba con un
doble de la tarea de renderizado.

### Tarea 7: componentes del visor

**Archivos:** `src/lib/ui/pdf/PdfView.svelte`, `PdfPage.svelte`,
`PdfToolbar.svelte`.

**Produce:** el visor con scroll continuo, zoom, ir a página, rotar. Libera los
lienzos que salen de la ventana.

**Pruebas:** de componente sobre la barra de herramientas; el resto se comprueba
a mano porque depende del renderizado real.

### Tarea 8: capa de texto y búsqueda

**Archivos:** `src/lib/pdf/text-layer.ts`, `src/lib/pdf/search.ts`.

**Produce:** capa de texto seleccionable sobre el lienzo; `extractText(handle)`
que cachea por página; `findInPdf(pages, query)` que devuelve página, índice y
contexto.

**Pruebas:** `findInPdf` es pura: sin acentos, sin distinguir mayúsculas, varias
apariciones en una página, ninguna.

### Tarea 9: miniaturas e índice

**Archivos:** `src/lib/ui/pdf/PdfThumbnails.svelte`, `PdfOutline.svelte`, y la
barra lateral.

**Produce:** dos pestañas más en la barra lateral cuando el documento activo es
un PDF.

## Etapa C — anotaciones

### Tarea 10: modelo y geometría

**Archivos:** `src/lib/pdf/annotations/model.ts`, `geometry.ts`.

**Produce:** el tipo `Annotation`, `sameAnnotations(a, b)` para saber si hay
cambios sin guardar, y las conversiones entre coordenadas de pantalla y de PDF
teniendo en cuenta escala y rotación.

**Pruebas:** ida y vuelta de coordenadas con las cuatro rotaciones; igualdad que
ignora el orden de la lista pero no el contenido.

### Tarea 11: selección a rectángulos

**Archivos:** `src/lib/pdf/annotations/quads.ts`.

**Produce:** `quadsFromRects(rects, pageRect, scale, rotation)` que agrupa por
línea y descarta los rectángulos vacíos.

**Pruebas:** una línea; dos líneas; selección que empieza a mitad de palabra;
rectángulos de altura cero.

### Tarea 12: leer las anotaciones de un archivo

**Archivos:** `src/lib/pdf/annotations/read.ts`.

**Produce:** `readAnnotations(handle)` que convierte las que Reader entiende y
marca el resto como intocables.

**Pruebas:** contra un PDF con anotaciones escritas por pdf-lib en el test.

### Tarea 13: escribirlas

**Archivos:** `src/lib/pdf/annotations/write.ts`.

**Produce:** `writeAnnotations(bytes, annotations): Promise<Uint8Array>` que
borra las que Reader había escrito, escribe las actuales con su flujo de
apariencia, y conserva las ajenas.

**Pruebas:** escribir, volver a leer con pdf.js y comprobar que coinciden tipo,
página, color y geometría. Este es el test que prueba la portabilidad.

### Tarea 14: capa de anotaciones e interfaz

**Archivos:** `src/lib/ui/pdf/AnnotationLayer.svelte`,
`AnnotationPopover.svelte`, y la barra de herramientas.

**Produce:** subrayar, tachar, resaltar, dibujar a mano, nota, rectángulo y
elipse, con selector de color, borrado y edición del texto de la nota.

### Tarea 15: guardado, historial y comprobación

**Archivos:** `src/App.svelte`, `src/lib/state/documents.svelte.ts`,
`src-tauri/src/commands/history.rs`.

**Produce:** guardar un PDF escribe las anotaciones y verifica el resultado antes
de sobrescribir; el historial guarda la lista de anotaciones en JSON.

### Tarea 16: medición, documentación y lista de comprobación

**Archivos:** `docs/perf.md`, `docs/smoke.md`, `README.md`,
`scripts/perf-pdf.ps1`.

**Produce:** las cifras reales frente a los presupuestos de la sección 4 del
spec, y las comprobaciones manuales, incluida la de abrir el PDF anotado en
Acrobat y en Edge.

## Después

Etapa D: organizar páginas. Etapa E: formularios y firma. Fase 3: edición de
contenido con el alcance de la sección 9 del spec.
