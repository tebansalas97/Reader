# Reader Fase 4 — plan de implementación

**Spec:** `docs/superpowers/specs/2026-09-10-reader-fase4-diseno.md`

## Reglas que valen para todas las tareas

- Sin comentarios en los archivos de código.
- Cada tarea deja las pruebas en verde antes de pasar a la siguiente.
- Lo que se pueda escribir como función pura va en su módulo con pruebas.
- Nada de esto puede tocar el arranque de un documento Markdown.

## Etapa 0 — licencia y reconocimiento

### Tarea 1: licencia

**Archivos:** `LICENSE`, `NOTICE`, `README.md`, `package.json`, `src-tauri/Cargo.toml`.

**Produce:** Apache 2.0 íntegra, el aviso a propagar, y el campo `license` en los dos
manifiestos.

### Tarea 2: terceros

**Archivos:** `scripts/third-party.mjs`, `THIRD-PARTY.md`.

**Produce:** la lista de dependencias con su licencia, sacada de `node_modules` y de
`cargo metadata`, con el diccionario español anotado como MPL-1.1. Se regenera con
`npm run licenses` y se comprueba en la compilación.

### Tarea 3: Acerca de

**Archivos:** `src/lib/ui/About.svelte`, menú, i18n.

**Produce:** ventana con versión, autor, licencia y terceros.

## Etapa A — cerrar lo que está a medias

### Tarea 4: buscar dentro del PDF

**Archivos:** `src/lib/ui/pdf/PdfSearch.svelte`, `SearchPanel.svelte`, `PdfView.svelte`.

**Produce:** el panel de búsqueda pasa a tener dos modos: carpeta y documento. Con un
PDF abierto busca en su texto con `search.ts`, agrupa por página, salta al hallazgo y
lo resalta un momento.

**Pruebas:** de componente sobre el panel; el motor ya tiene 27.

### Tarea 5: modos de lectura

**Archivos:** `PdfView.svelte`, `virtual.ts`, `documents.svelte.ts`.

**Produce:** continuo, página única y doble página, con `Ctrl+E`.

**Pruebas:** puras sobre la disposición en dos columnas.

### Tarea 6: insertar páginas de otro PDF

**Archivos:** `src/lib/pdf/save.ts`, `PdfThumbnails.svelte`, `App.svelte`.

**Produce:** botón para insertar otro PDF en la posición elegida.

## Etapa B — el uso diario

### Tarea 7: deshacer y rehacer

**Archivos:** `src/lib/state/history.svelte.ts`, `documents.svelte.ts`.

**Produce:** pila de estados editables del PDF con tope, y `Ctrl+Z` / `Ctrl+Y`.

### Tarea 8: autoguardado del PDF

### Tarea 9: recuperar la sesión

**Archivos:** `prefs.svelte.ts`, `App.svelte`.

### Tarea 10: modo noche del PDF

### Tarea 11: duplicar y seleccionar varias anotaciones

### Tarea 12: exportar e importar XFDF

**Archivos:** `src/lib/pdf/annotations/xfdf.ts`.

### Tarea 13: imprimir un rango

## Etapa C — editor de PDF completo

### Tarea 14: añadir texto nuevo

### Tarea 15: fuentes compuestas

### Tarea 16: redacción

### Tarea 17: mover una imagen ya guardada

## Etapa D — rendimiento

### Tarea 18: caché de páginas dibujadas

### Tarea 19: zoom por teselas

### Tarea 20: flujos de objetos al guardar

## Etapa E — distribución

### Tarea 21: actualización automática

### Tarea 22: preparar la firma del instalador

### Tarea 23: idiomas

## Etapa F — pruebas de extremo a extremo

### Tarea 24: `tauri-driver`

## Orden

0 → A → B → C → D → E → F. La Etapa 0 va primero porque es lo que el usuario pidió
como condición para publicar, y porque es barata.
