# Reader Fase 4 — plan de implementación

**Spec:** `docs/superpowers/specs/2026-09-10-reader-fase4-diseno.md`

## Reglas que valen para todas las tareas

- Sin comentarios en los archivos de código.
- Cada tarea deja las pruebas en verde antes de pasar a la siguiente.
- Lo que se pueda escribir como función pura va en su módulo con pruebas.
- Nada de esto puede tocar el arranque de un documento Markdown.

## Etapa 0 — licencia y reconocimiento

### Tarea 1: licencia — hecha

**Archivos:** `LICENSE`, `NOTICE`, `README.md`, `package.json`, `src-tauri/Cargo.toml`.

Apache 2.0 íntegra, el aviso a propagar, y el campo `license` en los dos
manifiestos.

### Tarea 2: terceros — hecha

**Archivos:** `scripts/third-party.mjs`, `THIRD-PARTY.md`.

La lista de dependencias con su licencia, sacada de `node_modules` y de
`cargo metadata`, con el diccionario español anotado como MPL-1.1. Se regenera
con `npm run licenses`.

### Tarea 3: Acerca de — hecha

**Archivos:** `src/lib/ui/About.svelte`, menú, i18n.

Ventana con versión, autor, licencia, terceros y enlace a las versiones
publicadas.

## Etapa A — cerrar lo que está a medias

### Tarea 4: buscar dentro del PDF — hecha

**Archivos:** `src/lib/ui/pdf/PdfSearch.svelte`, `SearchPanel.svelte`, `PdfView.svelte`.

El panel de búsqueda tiene dos modos: carpeta y documento. Con un PDF abierto
busca en su texto, agrupa por página, salta al hallazgo y lo resalta un momento.

### Tarea 5: modos de lectura — hecha

**Archivos:** `src/lib/pdf/spread.ts`, `PdfView.svelte`, `PdfToolbar.svelte`.

Continuo, página única y doble página, con `Ctrl+E`. El visor dibuja filas en vez
de páginas sueltas; en doble, el zoom de ajuste reparte el ancho entre las dos.

### Tarea 6: insertar páginas de otro PDF — hecha

**Archivos:** `src/lib/pdf/save.ts`, `PdfThumbnails.svelte`, `App.svelte`.

Botón en el esquema. Guarda lo pendiente, escribe el archivo con las páginas
nuevas y recarga el documento.

## Etapa B — el uso diario

### Tarea 7: deshacer y rehacer — hecha

**Archivos:** `src/lib/state/undo.svelte.ts`, `documents.svelte.ts`.

Pila de estados editables del PDF con tope de cincuenta pasos, y `Ctrl+Z` /
`Ctrl+Y`. En Markdown el atajo sigue siendo del editor.

### Tarea 8: autoguardado del PDF — hecha

**Archivos:** `src/lib/pdf/autosave.ts`, `App.svelte`.

Con la misma preferencia que el Markdown, espera mínima de tres segundos y solo
cuando no hay nada elegido ni un texto en edición.

### Tarea 9: recuperar la sesión — hecha

**Archivos:** `src/lib/state/session.ts`, `prefs.svelte.ts`, `App.svelte`, `Settings.svelte`.

Las rutas abiertas se guardan y se reabren al arrancar, salvo que la aplicación
reciba rutas por línea de órdenes.

### Tarea 10: modo noche del PDF — hecha

**Archivos:** `PdfPage.svelte`, `PdfToolbar.svelte`, `prefs.svelte.ts`.

Filtro sobre el lienzo, así las anotaciones dibujadas encima conservan su color.

### Tarea 11: duplicar y seleccionar varias anotaciones — hecha

**Archivos:** `src/lib/pdf/annotations/multi.ts`, `AnnotationLayer.svelte`, `ui.svelte.ts`.

Shift o Ctrl suman a la selección, el arrastre mueve el grupo entero y `Ctrl+D`
duplica.

### Tarea 12: exportar e importar XFDF — hecha

**Archivos:** `src/lib/pdf/annotations/xfdf.ts`, `Menu.svelte`, `App.svelte`.

Todo menos los sellos, que el formato no lleva; se avisa cuántos quedaron fuera.

### Tarea 13: imprimir un rango — hecha

**Archivos:** `src/lib/pdf/print-range.ts`, `PrintDialog.svelte`, `print.ts`.

Sintaxis `1-3,7` o `5-`. De paso, la impresión pasa a seguir el plan de páginas.

## Etapa C — editor de PDF completo

### Tarea 14: añadir texto nuevo — hecha

**Archivos:** `src/lib/pdf/annotations/freetext.ts`, `helvetica.ts`, `write.ts`, `paint.ts`.

Anotación FreeText de verdad, con apariencia en Helvetica, `/DA` y tamaño de
letra. La tabla de anchos la genera `npm run widths` y la comparten el visor y el
archivo, así el corte de línea es el mismo en los dos.

### Tarea 15: fuentes compuestas — hecha

**Archivos:** `src/lib/pdf/edit/cmap.ts`, `replace.ts`, `runs.ts`, `document.ts`.

Type0 con Identity-H: anchos del `/W` del descendiente y tabla de ida y vuelta
desde el `/ToUnicode`. Solo se aceptan las letras que ya están en el subconjunto.

### Tarea 16: redacción — hecha

**Archivos:** `src/lib/pdf/edit/redact.ts`, `document.ts`, `App.svelte`.

El texto de la zona se quita del flujo de contenido, letra a letra, con el hueco
compensado, y encima queda un rectángulo negro. Avisa de las imágenes, que no se
borran.

### Tarea 17: mover una imagen ya guardada — hecha

**Archivos:** `src/lib/pdf/annotations/write.ts`, `transform.ts`, `PdfPage.svelte`.

Se le cambia el `/Rect` al objeto que ya existe, con lo que la imagen viaja
intacta. Mientras se arrastra se ve un recorte del lienzo como fantasma. Girar
sigue sin permitirse.

## Etapa D — rendimiento

### Tarea 18: caché de páginas dibujadas — hecha

Seis páginas a cada lado conservan su lienzo al salir de la vista.

### Tarea 19: zoom por teselas — hecha

**Archivos:** `src/lib/pdf/tiles.ts`, `render.ts`, `PdfPage.svelte`.

Por encima de cuatro millones de píxeles se dibuja solo la parte visible,
redondeada a una rejilla de 256 píxeles.

### Tarea 20: flujos de objetos al guardar — hecha

`saveWritten` guarda con `useObjectStreams`, y el archivo ocupa bastante menos.

## Etapa E — distribución

### Tarea 21: actualización automática — pendiente del autor

Necesita una clave de firma y un sitio donde publicar. Los pasos están en
`docs/distribucion.md`. Hoy, «Acerca de» lleva a la página de versiones.

### Tarea 22: firma del instalador — pendiente del autor

Necesita comprar un certificado de firma de código. Pasos en
`docs/distribucion.md`.

### Tarea 23: idiomas — descartada a propósito

Español e inglés. Añadir un idioma es añadir un diccionario en `src/lib/i18n.ts`;
traducir cuatrocientas cadenas sin nadie que las revise deja una interfaz peor.

## Etapa F — pruebas de extremo a extremo

### Tarea 24: `tauri-driver`

## Orden

0 → A → B → C → D → E → F. La Etapa 0 va primero porque es lo que el usuario pidió
como condición para publicar, y porque es barata.
