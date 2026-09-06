# Reader

Lector y editor de escritorio para Markdown, construido sobre Tauri 2. Instalador
de 3.7 MB, arranque en 88 ms y una vista previa que se actualiza mientras
escribes sin tirones.

La Fase 2 añadirá PDF: visor, anotaciones, organización de páginas, formularios y
firma. La Fase 3, edición del contenido de un PDF.

## Qué hace hoy

- Vista dividida con scroll sincronizado en ambos sentidos, modo solo editor y
  modo lectura a pantalla completa.
- Markdown con tablas, listas de tareas, notas al pie y anclas en los títulos.
- Resaltado de código, fórmulas con KaTeX y diagramas con Mermaid, todos cargados
  bajo demanda: un documento que no los usa no paga su coste.
- Pestañas, árbol de archivos de la carpeta abierta y esquema del documento.
- Guardado atómico que respeta el final de línea original del archivo, con
  autoguardado configurable.
- Detección de cambios externos: recarga sola si no has tocado nada y te pregunta
  si sí lo has hecho.
- Arrastrar archivos para abrirlos y arrastrar o pegar imágenes para insertarlas
  en una carpeta `assets` junto al documento.
- Exportación a HTML autónomo, con las imágenes incrustadas, y a PDF a través del
  diálogo de impresión.
- Tema claro y oscuro que sigue al de Windows, interfaz en español o inglés.
- Barra de herramientas de formato con deshacer, títulos, énfasis, listas, cita,
  enlace, imagen, tabla, bloque de código, línea divisoria y búsqueda.
- Resaltado del bloque que estás editando en la vista previa, y doble clic en la
  vista previa para llevar el cursor a esa línea del editor.
- Botón de copiar en cada bloque de código.
- Casillas de tarea marcables desde la vista previa: el cambio se escribe en el
  archivo.
- Doble clic selecciona la palabra, triple clic la frase, sin arrastrar el salto
  de línea.
- La vista previa marca la selección exacta dentro del bloque activo.
- Visor de diagramas a pantalla completa con zoom, desplazamiento y exportación a
  SVG o PNG.
- Interruptor para activar o desactivar la sincronización del scroll.
- Paleta de comandos con `Ctrl+Shift+P`.
- Pegar desde el navegador convierte el HTML a Markdown.

## Requisitos para desarrollar

Node 22, Rust estable y las Build Tools de Visual Studio. WebView2 ya viene con
Windows 11.

```bash
npm install
npm run tauri dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run tauri dev` | Arranca la app con recarga en caliente |
| `npm test` | Ejecuta las pruebas del frontend |
| `npm run check` | Comprueba tipos en TypeScript y Svelte |
| `npm run build:app` | Compila el instalador NSIS |
| `npm run perf` | Mide arranque, memoria y tamaño, y escribe `docs/perf.md` |
| `cargo test` | Ejecuta las pruebas de Rust, desde `src-tauri` |

## Atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl+N` | Documento nuevo |
| `Ctrl+O` | Abrir archivo |
| `Ctrl+Shift+O` | Abrir carpeta |
| `Ctrl+S` | Guardar |
| `Ctrl+Shift+S` | Guardar como |
| `Ctrl+W` | Cerrar pestaña |
| `Ctrl+Tab` | Pestaña siguiente |
| `Ctrl+E` | Cambiar de vista |
| `Ctrl+Shift+E` | Panel de archivos |
| `Ctrl+Shift+U` | Panel de esquema |
| `F11` | Modo zen |
| `Ctrl+Shift+H` | Exportar a HTML |
| `Ctrl+P` | Exportar a PDF |
| `Ctrl+Shift+P` | Paleta de comandos |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | Aumentar, reducir o restaurar el tamano del texto |
| `Ctrl+,` | Preferencias |

Dentro del editor: `Ctrl+B` negrita, `Ctrl+I` cursiva, `` Ctrl+` `` código,
`Ctrl+K` enlace, `Ctrl+1` a `Ctrl+6` títulos, `Ctrl+Shift+L` lista,
`Ctrl+Shift+T` tarea, `Ctrl+Shift+Q` cita, `Ctrl+F` buscar, `Ctrl+H` reemplazar,
`Alt+Arriba` y `Alt+Abajo` mover la línea, `Ctrl+Shift+D` duplicarla,
`Ctrl+Shift+K` borrarla, `Ctrl+L` seleccionarla y `Ctrl+D` seleccionar la
siguiente aparición.

## Arquitectura

El WebView es dueño del estado del documento y de todo lo visual. Rust es un
servicio de sistema de archivos y preferencias sin estado propio, salvo el
registro de archivos vigilados.

El parser de Markdown vive en JavaScript, dentro del WebView, para que no haya
ningún viaje por el puente entre procesos en cada pulsación de tecla. La vista
previa nunca reemplaza su HTML entero: se parchean solo los nodos que cambian.

El diseño completo está en
`docs/superpowers/specs/2026-09-04-reader-fase1-design.md` y el plan de
implementación en `docs/superpowers/plans/2026-09-04-reader-fase1.md`.

## Rendimiento

Las cifras medidas y los presupuestos están en `docs/perf.md`. El resumen: el
instalador ocupa 3.7 MB, la app arranca en 88 ms con un documento de 100 KB y
consume alrededor de una sexta parte de la memoria privada de Visual Studio Code
en la misma máquina.
