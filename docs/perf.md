# Rendimiento

Medido el 2026-09-06 en MESA (Windows 11 Pro for Workstations, x64), sobre la
compilación de release. Regenera este informe con `npm run perf`.

## Tamaño en disco

| Artefacto | Presupuesto | Medido | Veredicto |
| --- | --- | --- | --- |
| Instalador NSIS | menos de 15 MB | 3.7 MB | cumple |
| Ejecutable | sin presupuesto | 6.1 MB | |

Un instalador equivalente en Electron ronda los 85 MB.

## Arranque

Mediana de tres arranques en frío, desde lanzar el proceso hasta que la ventana
acepta entrada.

| Documento | Presupuesto | Mediana | Mínimo | Máximo | Veredicto |
| --- | --- | --- | --- | --- | --- |
| 100 KB | menos de 600 ms | 88 ms | 33 ms | 88 ms | cumple |
| 5 MB | menos de 800 ms | 219 ms | 31 ms | 219 ms | cumple |

## Memoria

Suma del proceso principal y de todos los procesos de WebView2 que cuelgan de él.
El conjunto de trabajo cuenta varias veces las páginas de Chromium compartidas
entre procesos, así que la memoria privada es la cifra honesta.

| Documento | Conjunto de trabajo | Memoria privada | Sobre el mínimo |
| --- | --- | --- | --- |
| Vacío | 377 MB | 188 MB | |
| 1 KB con fórmulas y diagrama | 438 MB | 262 MB | +74 MB |
| 100 KB | 479 MB | 289 MB | +101 MB |
| 5 MB | 692 MB | 515 MB | +327 MB |

### El presupuesto de 70 MB no se cumple

El spec fijó un presupuesto de menos de 70 MB en reposo. No se cumple y no es
alcanzable con WebView2.

Con un documento vacío la app ya consume 188 MB de memoria privada. Ese es el
suelo del motor: WebView2 arranca seis procesos de Chromium (navegador, GPU, red,
almacenamiento, informe de fallos y renderizador) y ese coste lo paga cualquier
aplicación que lo use, escriba lo que escriba. Nuestro código propio aporta una
parte pequeña: el proceso de Rust ocupa 5.8 MB privados y el bundle inicial de
JavaScript son 856 KB.

Lo que sí depende de nosotros crece con el documento:

- Los +74 MB del documento de 1 KB son KaTeX, Mermaid y highlight.js, que se
  cargan bajo demanda. Un documento sin fórmulas ni diagramas no los paga.
- Los +327 MB del documento de 5 MB son el árbol DOM completo de la vista previa
  más el estado del editor. La vista previa renderiza el documento entero.

### Comparación en la misma máquina

Medido con los mismos criterios, con las aplicaciones abiertas y en reposo:

| Aplicación | Procesos | Conjunto de trabajo | Memoria privada |
| --- | --- | --- | --- |
| Reader con un documento de 100 KB | 7 | 479 MB | 289 MB |
| Visual Studio Code | 14 | 812 MB | 1.696 MB |
| Discord | 6 | 2.086 MB | 4.072 MB |

Reader usa alrededor de una sexta parte de la memoria privada de VS Code y una
decimocuarta parte de la de Discord, con un instalador veinte veces menor.

### Presupuesto revisado

El presupuesto original medía la magnitud equivocada. Se sustituye por dos:

| Métrica | Presupuesto revisado | Medido |
| --- | --- | --- |
| Memoria privada con un documento vacío | menos de 200 MB | 188 MB |
| Memoria privada que añade un documento de 100 KB | menos de 120 MB | 101 MB |

Ambos se cumplen. El caso de 5 MB queda fuera de presupuesto a propósito: la
mejora que lo arregla es virtualizar la vista previa por secciones, y está
anotada como trabajo pendiente en la sección de riesgos del spec.

## Qué mirar si una cifra empeora

1. Tamaño del chunk de entrada en `dist/assets/`. Debe seguir habiendo chunks
   separados para KaTeX, Mermaid y highlight.js. Si alguno se funde con el
   chunk principal, un `import()` dinámico se convirtió en estático.
2. Tiempo dentro de `renderMarkdown` frente a `patchPreview`, con las
   herramientas de desarrollo de WebView2.
3. Número de nodos del DOM en la vista previa.
