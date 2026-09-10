# Reader — Fase 2: PDF

Fecha: 2026-09-06
Estado: aprobado por Esteban (motor en JavaScript, anotaciones dentro del PDF, anotar antes que organizar)

## 1. Objetivo

Añadir PDF a Reader sin perder lo que la hace buena: instalador pequeño, arranque
rápido y una interfaz que no estorba. Quien solo use Markdown no debe pagar nada
por esto.

Criterio de éxito: abrir un PDF de doscientas páginas y estar leyendo en menos de
un segundo y medio, subrayar una frase, guardarla, y que ese subrayado se vea
igual en Acrobat, en Edge y en el visor de Windows.

## 2. Decisiones ya tomadas

| Decisión | Elección | Motivo |
| --- | --- | --- |
| Motor de lectura | pdf.js | Es el visor de Firefox, da capa de texto y no añade peso nativo |
| Motor de escritura | pdf-lib | Escribe anotaciones, páginas y formularios en JavaScript puro |
| Carga | Bajo demanda | Igual que KaTeX y Mermaid: un documento Markdown no descarga nada |
| Anotaciones | Dentro del archivo | Se ven en cualquier visor; el precio es que guardar modifica el PDF |
| Orden | Visor, anotar, páginas, formularios | Anotar es lo que más se usa al leer |
| Edición de contenido | Fase 3 | Ver la sección 9 sobre su alcance real |

## 3. Lo que esta fase no promete

Un PDF no guarda párrafos, guarda instrucciones de dibujo. Por eso esta fase no
incluye reescribir el texto existente. Se aborda en la Fase 3 con un alcance
honesto: sustituir un bloque corto conservando su fuente y su caja, y avisar
cuando el cambio no cabe o la fuente no está incrustada.

Tampoco entra en esta fase el reconocimiento óptico de documentos escaneados.

## 4. Presupuestos

| Métrica | Presupuesto |
| --- | --- |
| Crecimiento del instalador | menos de 3 MB |
| Arranque de la app sin abrir un PDF | sin cambio medible respecto a la Fase 1 |
| Abrir un PDF de 200 páginas hasta ver la primera | < 1500 ms |
| Pasar de página en un documento ya abierto | < 120 ms |
| Scroll continuo | 60 fps |
| Memoria privada adicional con un PDF de 200 páginas abierto | < 250 MB |
| Guardar un PDF de 20 MB con anotaciones | < 2000 ms |

Reglas derivadas:

- `pdfjs-dist` y `pdf-lib` se cargan con `import()` dinámico. El chunk de entrada
  no puede crecer; se verifica en la compilación igual que con Mermaid.
- Solo se renderizan las páginas visibles más dos por cada lado. Las demás se
  reservan con un hueco del alto correcto para que la barra de scroll no salte.
- Los lienzos de páginas que salen de la ventana se liberan.
- El archivo no se pasa por el puente de procesos. pdf.js lo lee por el
  protocolo `asset://`, que ya está en uso para las imágenes de Markdown.

## 5. Arquitectura

### 5.1 El modelo de documento se convierte en una unión

Hoy `Document` asume Markdown. Se separa en dos formas con un discriminante, que
es la única manera de que el resto del código no acumule campos opcionales sin
sentido.

```ts
interface BaseDocument {
  id: string;
  path: string | null;
  title: string;
  modifiedMs: number;
  readOnly: boolean;
  externalChange: 'none' | 'modified' | 'removed';
}

interface MarkdownDocument extends BaseDocument {
  kind: 'markdown';
  text: string;
  savedText: string;
  lineEnding: LineEnding;
  previewDisabled: boolean;
  cursor: { line: number; col: number };
  scrollLine: number;
}

interface PdfDocument extends BaseDocument {
  kind: 'pdf';
  assetUrl: string;
  pageCount: number;
  page: number;
  zoom: number | 'fit-width' | 'fit-page';
  annotations: Annotation[];
  savedAnnotations: Annotation[];
  encrypted: boolean;
}

type Document = MarkdownDocument | PdfDocument;
```

`isDirty` deja de comparar solo texto: para Markdown compara `text` con
`savedText`, para PDF compara la lista de anotaciones con la guardada. Todo el
código que hoy lee `doc.text` pasa por una guarda de tipo.

### 5.2 Estructura de archivos nueva

```
src/lib/pdf/
  load.ts            carga perezosa de pdfjs y configuración del worker
  document.ts        abrir un PDF, contar páginas, leer el índice
  render.ts          renderizar una página a un lienzo con su escala
  text-layer.ts      capa de texto para selección y búsqueda
  virtual.ts         qué páginas hay que tener vivas dadas la ventana y el scroll
  annotations/
    model.ts         tipos, identidad, comparación e igualdad
    geometry.ts      conversión entre coordenadas de pantalla y de PDF
    quads.ts         rectángulos de una selección de texto para subrayados
    read.ts          leer las anotaciones existentes de un PDF
    write.ts         escribirlas con pdf-lib, con flujo de apariencia
  search.ts          buscar en el texto de todas las páginas
src/lib/ui/pdf/
  PdfView.svelte     contenedor con scroll y virtualización
  PdfPage.svelte     una página: lienzo, capa de texto, capa de anotaciones
  PdfToolbar.svelte  zoom, navegación, herramientas de anotación
  PdfThumbnails.svelte
  PdfOutline.svelte
  AnnotationLayer.svelte
  AnnotationPopover.svelte
```

### 5.3 Flujo de apertura

1. El usuario abre un `.pdf`. `documents.open` detecta la extensión.
2. Se autoriza la carpeta en el protocolo de assets, igual que con las imágenes.
3. `import('pdfjs-dist')` la primera vez. El worker se sirve como archivo
   estático desde `public/`, igual que los diccionarios.
4. `getDocument({ url })` con el `asset://` del archivo. Nada de bytes por IPC.
5. Se leen el número de páginas, los tamaños y el índice.
6. Se pinta la primera página y se reservan huecos para el resto.

Si el PDF está cifrado con contraseña de apertura, se pide la contraseña. Si está
cifrado de forma que pdf-lib no pueda reescribirlo, se abre en solo lectura con
aviso: se puede leer y anotar en pantalla, pero no guardar.

### 5.4 Virtualización

`virtual.ts` es una función pura: dado el alto de cada página, el scroll y el
alto de la ventana, devuelve qué páginas están visibles y cuáles deben estar
renderizadas. El componente solo obedece. Así se puede probar sin navegador.

```ts
function visibleRange(heights: number[], scrollTop: number, viewport: number, overscan: number)
  : { first: number; last: number; offsets: number[] }
```

### 5.5 Modelo de anotación

```ts
type AnnotationKind = 'highlight' | 'underline' | 'strikeout' | 'ink' | 'note' | 'rect' | 'ellipse';

interface Annotation {
  id: string;
  page: number;
  kind: AnnotationKind;
  color: string;
  opacity: number;
  contents: string;
  author: string;
  createdMs: number;
  quads?: Quad[];
  ink?: Point[][];
  rect?: Rect;
  origin: 'reader' | 'file';
}
```

Las coordenadas se guardan siempre en el espacio del PDF, con el origen abajo a
la izquierda y sin rotación aplicada. `geometry.ts` traduce en los dos sentidos.
Guardar coordenadas de pantalla sería un error: cambiarían con el zoom.

`origin` distingue lo que ya venía en el archivo de lo que ha puesto Reader. Las
del archivo que Reader no entiende se conservan intactas al guardar.

### 5.6 Escritura

Al guardar, `write.ts` carga los bytes originales con pdf-lib y escribe solo la
diferencia. Cada anotación que Reader leyó del archivo guarda la referencia del
objeto que pdf.js le dio (`12R`), y con ella se decide una por una:

- La que no ha cambiado se queda tal cual estaba, sin reescribirla.
- La que se borró o se editó se saca del `/Annots` de su página y su objeto se
  elimina.
- La nueva, y la editada, se escriben desde cero.
- Todo lo que Reader no modela (enlaces, campos de formulario, sellos, texto
  libre) no se toca nunca, porque nunca entra en la lista.

Es mejor que borrar y reescribir todo lo de Reader: el archivo cambia lo mínimo
y una anotación ajena que Reader entiende conserva sus datos si nadie la toca.

Cada anotación se escribe como un diccionario PDF real con su subtipo, y con un
flujo de apariencia propio para que se vea igual en visores que no generan
apariencias. El color va en `/C` con cinco decimales: con dos, un color como
`#4dabf7` vuelve del archivo como `#4cabf7` y el documento parecería tener
cambios sin guardar nada más guardarlo.

| Tipo | Subtipo PDF | Geometría |
| --- | --- | --- |
| Resaltado | `/Highlight` | `/QuadPoints` |
| Subrayado | `/Underline` | `/QuadPoints` |
| Tachado | `/StrikeOut` | `/QuadPoints` |
| Dibujo | `/Ink` | `/InkList` |
| Nota | `/Text` | `/Rect` |
| Rectángulo | `/Square` | `/Rect` |
| Elipse | `/Circle` | `/Rect` |

Escritura atómica: se escribe a un temporal y se renombra, como ya hace el
guardado de Markdown. El comando `write_bytes` de Rust pasa a ser atómico, que
hoy no lo es.

### 5.6.1 Quién dibuja cada anotación

pdf.js dibuja en el lienzo las anotaciones del archivo que traen apariencia. Si
Reader dibujara además las suyas encima, una anotación ya guardada se vería dos
veces, y borrarla o cambiarle el color no se notaría hasta guardar y reabrir.

La solución es el almacén de anotaciones de pdf.js: al abrir, Reader marca con
`noView` las anotaciones que gestiona y las dibuja él mismo en su capa. El
lienzo sigue dibujando todo lo demás con la fidelidad del archivo, y lo que
Reader pinta responde al momento a cualquier cambio.

### 5.6.2 Mover, estirar y girar

Una anotación seleccionada trae un recuadro con cuatro tiradores en las esquinas
para estirarla y, cuando su forma lo admite, uno redondo arriba para girarla. Se
mueve arrastrándola y con las flechas del teclado.

Todo se calcula en coordenadas del PDF, no de pantalla, así que funciona igual
con cualquier zoom y con la página girada.

Girar solo se ofrece donde el PDF lo puede guardar de verdad:

- Resaltado, subrayado y tachado guardan cuatro esquinas por línea
  (`/QuadPoints`), que no tienen por qué formar un rectángulo recto. Por eso se
  pueden girar, y por eso se dibujan como polígonos y no como rectángulos, tanto
  en pantalla como en el flujo de apariencia.
- Un dibujo (`/Ink`) es una lista de puntos: girarlo es girarlos.
- Un rectángulo (`/Square`) y una elipse (`/Circle`) son, por definición del
  formato, cajas rectas. Un rectángulo girado dejaría de ser un rectángulo en
  cualquier otro visor, así que no se ofrece el giro para ellos. Para una forma
  girada está el lápiz.

### 5.7 Selección de texto y subrayado

pdf.js entrega, por página, los elementos de texto con su posición. La capa de
texto los coloca transparentes sobre el lienzo para que el navegador maneje la
selección nativa. Al soltar el ratón con una herramienta de resaltado activa, se
convierte la selección en rectángulos por línea y de ahí a `QuadPoints`.

### 5.8 Búsqueda

`Ctrl+F` dentro de un PDF busca en el texto de todas las páginas, no solo en las
visibles. El texto de cada página se extrae una vez y se guarda. Los resultados
se listan en la barra lateral, igual que la búsqueda en carpeta, y saltan a la
página con el hallazgo resaltado.

### 5.9 Interfaz

El PDF reutiliza las pestañas, la barra de título, la barra de estado y la barra
lateral. Cambia el centro y la barra de herramientas.

- **Barra de herramientas del PDF**: página actual y total, anterior y siguiente,
  zoom con ajustar al ancho y a la página, rotar la vista, y las herramientas de
  anotación con su selector de color.
- **Barra lateral**: se añaden dos pestañas cuando el documento activo es un PDF,
  miniaturas e índice. Las de archivos, buscar e historial siguen funcionando.
- **Barra de estado**: página actual de total, tamaño del documento, y el
  indicador de guardado que ya existe.
- **Modo lectura**: `Ctrl+E` alterna entre página única y desplazamiento
  continuo. El modo zen esconde todo igual que ahora.

Las herramientas de anotación se activan y se quedan activas hasta que se
desactivan, para poder subrayar varias frases seguidas sin volver a la barra.

### 5.10 Historial y cambios externos

El historial local guarda también los PDF, pero solo la lista de anotaciones en
JSON, no el archivo entero: guardar cuarenta copias de un PDF de 20 MB llenaría
el disco. Restaurar una versión repone las anotaciones de ese momento.

La detección de cambios externos funciona igual. Si el PDF cambia en disco y no
hay anotaciones sin guardar, se recarga; si las hay, se pregunta.

## 6. Errores

- PDF dañado o que no es un PDF: aviso claro y no se abre la pestaña.
- PDF cifrado con contraseña: se pide; tres intentos y se abandona.
- PDF que pdf-lib no puede reescribir: se abre en solo lectura con el motivo.
- Fallo al guardar: la anotación no se pierde, se ofrece guardar como.
- Página que no se puede renderizar: se muestra el hueco con el número de página
  y un aviso, y el resto del documento sigue funcionando.

## 7. Seguridad

- pdf.js se configura sin ejecutar JavaScript incrustado en el PDF, que es un
  vector de ataque conocido. Los formularios se rellenan sin ejecutar sus
  acciones.
- Los enlaces dentro del PDF pasan por la misma comprobación de esquema que los
  de Markdown: solo `http`, `https` y `mailto` salen al navegador.
- El worker de pdf.js se sirve desde el propio origen; la política de contenido
  necesita `worker-src 'self' blob:`.

## 8. Pruebas

- **Puras (Vitest)**: virtualización, geometría entre pantalla y PDF, conversión
  de selección a `QuadPoints`, modelo e igualdad de anotaciones, comparación para
  saber si hay cambios sin guardar, búsqueda sobre texto extraído.
- **Contra archivos reales**: se generan PDF de prueba con pdf-lib en el propio
  test, se escriben anotaciones, se vuelven a leer con pdf.js y se comprueba que
  coinciden. Este es el test que de verdad prueba la portabilidad.
- **Componentes**: la barra de herramientas del PDF, las miniaturas, el índice.
- **Rust**: escritura atómica de bytes.
- **Manual**: abrir el PDF anotado en Acrobat y en Edge y comprobar que se ve
  igual. Esto no se puede automatizar aquí y va en la lista de comprobación.

## 8.1 Etapa D: organizar páginas

El documento lleva un plan de páginas: una lista que dice qué página del archivo
va en cada sitio y con cuánto giro añadido.

```ts
interface PageEdit {
  source: number;             // página en el archivo tal como está en disco
  rotation: 0 | 90 | 180 | 270;
}
```

El visor lee por el plan, no por el archivo: lo que se ve antes de guardar es
como quedará. El plan cuenta como cambio sin guardar igual que las anotaciones.

La decisión que lo hace simple es que **las anotaciones se guardan por su página
en el archivo, no por su posición**. Una anotación de la página 3 sigue siendo de
la página 3 aunque esa página pase a ser la primera. Al guardar, las páginas se
reordenan moviendo los mismos objetos de página, y sus anotaciones viajan con
ellas porque cuelgan de la página, no del número. Así no hay que renumerar nada
y la comparación que decide qué reescribir sigue valiendo.

Quitar una página con anotaciones sí las pierde, y por eso se avisa antes con la
cuenta exacta.

Guardar aplica el plan y las anotaciones en la misma pasada de pdf-lib
(`save.ts`), y comprueba el resultado abriéndolo antes de tocar el disco.

Extraer páginas escribe un archivo nuevo con copias de las elegidas, con sus
anotaciones, y no toca el original.

## 8.2 Etapa E: formularios y firma

pdf.js entrega los campos del formulario como anotaciones de tipo widget, con su
nombre completo, su tipo, su valor y su caja. Reader los modela aparte de las
anotaciones porque no son marcas sobre el documento: son datos del archivo.

Los valores se guardan por **nombre de campo**, no por widget, que es lo que
hace que un grupo de botones de radio funcione: varios widgets comparten nombre
y cada uno aporta su valor de exportación.

Los widgets se ocultan del lienzo igual que las anotaciones que Reader gestiona,
y encima se dibujan controles de verdad (campo de texto, área de texto, casilla,
radio y lista). Así lo que se escribe se ve al momento y no hay dos capas
peleando.

Al guardar, pdf-lib escribe los valores y regenera las apariencias con Helvetica
incrustada, que es lo que hace que el formulario relleno se vea en cualquier
visor y no solo en el que lo escribió. Los botones de acción no se tocan: Reader
no ejecuta el JavaScript de un PDF, que es un vector de ataque conocido.

El catálogo guarda firmas y sellos en su propio archivo, aparte de las
preferencias, porque puede llevar imágenes. Cada entrada tiene nombre y es de
uno de dos tipos: dibujo o imagen. Un nombre escrito se convierte en imagen al
guardarlo, dibujándolo con letra manuscrita.

Un dibujo se coloca como anotación de tinta. Una imagen se coloca como
anotación `/Stamp`, con su geometría en cuatro esquinas: por eso se mueve, se
estira y se gira con lo mismo que el resto, y por eso puede quedar torcida sin
dejar de ser válida en el archivo.

Un sello que Reader acaba de escribir se sigue viendo porque el visor recarga el
archivo tras guardarlo. A partir de ahí es parte del PDF y ya no se puede mover:
pdf.js no devuelve la imagen que hay dentro de una anotación, así que Reader no
puede volver a dibujarla. Sí se puede seleccionar y borrar, y no se reescribe ni
se duplica al guardar de nuevo.

La firma es un dibujo, no un certificado. Se dibuja una vez en un panel, se
guarda normalizada en las preferencias, y al pulsar en el documento se coloca
como una anotación de tinta con el ancho de una firma. Por eso se puede mover,
estirar y girar como cualquier dibujo, viaja dentro del archivo y se imprime.
Una firma criptográfica es otra cosa y no entra aquí.

## 9. Fase 3, para que conste

Editar el texto existente. Alcance realista: seleccionar un fragmento de una
línea, escribir otro, y que Reader lo sustituya conservando fuente, tamaño y
color, ajustando el espaciado dentro de la misma caja. Si el texto nuevo no cabe,
si la fuente no está incrustada o si no tiene los caracteres necesarios, se avisa
y no se toca el archivo. Nada de reflujo entre líneas ni entre páginas.

## 10. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| pdf-lib reescribe el archivo entero y puede romper PDF raros | Antes de sobrescribir, se vuelve a abrir el resultado con pdf.js y se comprueba que tiene las mismas páginas; si no, se aborta y se avisa |
| El chunk de pdf.js acaba en el arranque | Se comprueba en cada compilación que no está en el chunk de entrada |
| Documentos escaneados de muchas páginas van lentos | Está previsto añadir renderizado nativo solo para el lienzo sin tocar el resto |
| La unión de tipos toca mucho código existente | Se hace primero, en su propia tarea, con las 508 pruebas actuales como red |
