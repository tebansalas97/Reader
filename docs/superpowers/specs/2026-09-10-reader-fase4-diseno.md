# Reader — Fase 4: publicar y pulir

Fecha: 2026-09-10
Estado: aprobado por Esteban (open source con reconocimiento, y todas las mejoras de la lista)

## 1. Objetivo

Dos cosas a la vez:

1. **Poder publicar el código** sin que eso signifique regalarlo: quien lo use tiene
   que reconocer de quién es.
2. **Cerrar la lista de mejoras** que salió al terminar la Fase 3, empezando por lo
   que está a medio hacer y por lo que hoy hace daño en el uso diario.

Criterio de éxito: alguien clona el repositorio, compila, y lo que obtiene lleva el
nombre de Esteban D. Salas Herrera de forma que no se pueda quitar sin incumplir la
licencia. Y el que ya usa Reader nota tres cosas el primer día: que puede buscar
dentro de un PDF, que puede deshacer, y que no se le pierde la sesión.

## 2. Licencia y reconocimiento

### 2.1 La elección

**Apache License 2.0, con archivo `NOTICE`.**

El motivo es que es la única licencia estándar y reconocible que obliga al
reconocimiento de una forma que se puede exigir:

- Quien redistribuya el código o un binario derivado tiene que conservar el aviso
  de copyright y **entregar el contenido del `NOTICE`** (cláusula 4d).
- Quien modifique archivos tiene que decir que los modificó (cláusula 4b).
- Añade concesión de patentes, que MIT no tiene, y protege a Esteban si alguien
  intenta patentar algo sobre esta base.

Conviene decir una cosa con claridad, porque es la fuente de casi todos los malos
entendidos con las licencias: **ninguna licencia de código abierto reconocida
obliga a poner tu nombre en la pantalla de otro producto.** La cláusula de
publicidad existió (BSD de cuatro cláusulas) y se retiró porque se volvió
inmanejable. Lo que sí se puede exigir, y lo que hace Apache 2.0, es que el
reconocimiento viaje con el código y con la documentación de quien lo redistribuye.
Si algún día quieres reconocimiento visible en la interfaz de terceros, eso ya no es
código abierto: es una licencia propia, y hay que decirlo con ese nombre.

### 2.2 Qué se escribe

- `LICENSE`: el texto íntegro de Apache 2.0.
- `NOTICE`: el aviso que hay que propagar. Nombre, año, proyecto y la frase de
  reconocimiento.
- Cabecera de copyright: **no** en cada archivo. La regla del proyecto es que no hay
  comentarios en el código, y Apache 2.0 no obliga a poner cabeceras: obliga a
  conservar las que haya. Se pone en `LICENSE`, en `NOTICE`, en `README.md`, en
  `package.json` y en `Cargo.toml`.

### 2.3 Lo que traemos de otros

Reader distribuye código de terceros dentro del instalador. Auditado hoy:

| De dónde | Licencia | Qué implica |
| --- | --- | --- |
| pdf.js | Apache-2.0 | Hay que propagar su aviso |
| pdf-lib, Svelte, CodeMirror, markdown-it, KaTeX, Mermaid, nspell, morphdom | MIT | Conservar el aviso |
| highlight.js | BSD-3-Clause | Conservar el aviso |
| DOMPurify | MPL-2.0 o Apache-2.0 | Se elige Apache-2.0 |
| Tauri y 511 cajas de Rust | MIT, Apache-2.0, Zlib, ISC, BSD, MPL-2.0, Unicode-3.0 | Todas permisivas, ninguna copyleft fuerte |
| `dictionary-en` | MIT y BSD | Conservar el aviso |
| `dictionary-es` | **GPL-3.0 o LGPL-3.0 o MPL-1.1** | Se elige **MPL-1.1** |

El diccionario español es el único caso delicado, y por eso queda escrito aquí: se
ofrece con tres licencias a elegir, y una de ellas es la GPL. Distribuirlo bajo GPL
obligaría a publicar todo Reader bajo GPL. **Se elige MPL-1.1**, que es copyleft por
archivo: se puede redistribuir el diccionario tal cual dentro de una aplicación
Apache-2.0 siempre que se acompañe su licencia y no se modifique el archivo. No lo
modificamos.

De ahí sale un archivo `THIRD-PARTY.md` generado por un script, no escrito a mano,
para que no se quede desfasado.

### 2.4 En la aplicación

Una ventana **Acerca de** con la versión, el autor, la licencia y la lista de
terceros. No es adorno: es donde vive el reconocimiento para quien nunca va a abrir
el repositorio.

## 3. Etapas

### Etapa A — cerrar lo que está a medias

1. **Buscar dentro del PDF.** El motor está escrito y probado desde la Etapa B de la
   Fase 2 y nunca se conectó. Panel lateral con los resultados agrupados por página,
   salto al hallazgo y resaltado temporal sobre la página.
2. **Modos de lectura.** `Ctrl+E` alterna desplazamiento continuo, página única y
   doble página. Lo prometía la sección 5.9 del spec de la Fase 2.
3. **Insertar páginas de otro PDF.** Completa la Etapa D: combinar dos archivos.

### Etapa B — el uso diario

4. **Deshacer y rehacer en el PDF.** Historial de estados del documento (anotaciones,
   plan de páginas, campos y ediciones de texto) con `Ctrl+Z` y `Ctrl+Y`. Hoy borrar
   una anotación no tiene vuelta atrás hasta guardar, que es el fallo de uso más
   caro que queda.
5. **Autoguardado del PDF**, con el mismo ajuste que ya tiene Markdown.
6. **Recuperar la sesión**: las pestañas abiertas, su página y su zoom.
7. **Modo noche del PDF**: invertir el lienzo sin tocar el archivo.
8. **Duplicar y copiar anotaciones**, y seleccionar varias.
9. **Exportar e importar anotaciones** en XFDF.
10. **Imprimir un rango de páginas.**

### Etapa C — editor de PDF completo

11. **Añadir texto nuevo** (`/FreeText`): escribir donde no había nada.
12. **Fuentes compuestas** en la edición de texto: leer el CMap y la tabla `/W` para
    poder reescribir lo que sale de Word.
13. **Redacción**: quitar el texto del flujo de contenido, no taparlo.
14. **Mover una imagen ya guardada**: leer la imagen de vuelta desde su flujo de
    apariencia y volver a tratarla como propia.

### Etapa D — rendimiento

15. **Caché de páginas dibujadas**, para que volver atrás sea instantáneo.
16. **Zoom alto por teselas.**
17. **Guardar con flujos de objetos**, para que el archivo no engorde.

### Etapa E — distribución

18. **Actualización automática** con el plugin de Tauri: manifiesto, firma de la
    actualización y aviso dentro de la app.
19. **Firma del instalador.** Necesita un certificado de firma de código que solo
    puede comprar Esteban. Se deja el proyecto preparado y documentado.
20. **Más idiomas**: la infraestructura ya existe, falta abrirla.

### Etapa F — cómo lo construimos

21. **Pruebas de extremo a extremo** con `tauri-driver`, para que los fallos de
    interacción no dependan de que Esteban los cace a mano.

## 4. Presupuestos que no se pueden empeorar

| Métrica | Límite |
| --- | --- |
| Arranque hasta el primer pintado | sin cambio medible |
| Crecimiento del instalador | menos de 1 MB por toda la Fase 4 |
| Memoria privada con un PDF de 200 páginas | < 250 MB |
| Buscar en un PDF de 200 páginas | < 1200 ms la primera vez, instantáneo después |
| Deshacer | < 16 ms |

## 5. Lo que esta fase no promete

- **Firma criptográfica con certificado** (PAdES). Es otro proyecto.
- **Reconocimiento óptico** de documentos escaneados.
- **Reflujo de texto** entre líneas o entre páginas al editar.
- **Dibujar el lienzo desde Rust** para documentos escaneados enormes; queda anotado
  como salida si el caché de páginas no basta.

## 6. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El historial de deshacer se come la memoria con PDF grandes | Guarda solo el estado editable, nunca los bytes del archivo; tope de 50 pasos |
| Las fuentes compuestas son un pozo sin fondo | Solo Identity-H con CIDToGIDMap directo o CMap incrustado; lo demás se sigue negando con su motivo |
| La actualización automática puede romper una instalación | Firma obligatoria del manifiesto y aviso al usuario antes de instalar |
| XFDF tiene mil variantes | Se escribe el subconjunto que Reader entiende y se ignora el resto sin fallar |
| El script de terceros se desfasa | Se genera en cada compilación, no a mano |
