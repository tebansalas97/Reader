# Diagrama extenso

Este documento existe para probar el visor de diagramas con uno que no cabe en el
panel de la vista previa.

```mermaid
graph TD
  A[Usuario abre un archivo] --> B{¿Extensión conocida?}
  B -->|.md o .markdown| C[Leer con read_text]
  B -->|imagen| D[Guardar en assets]
  B -->|otra| E[Ignorar]
  C --> F{¿Es UTF-8?}
  F -->|no| G[Abrir en solo lectura]
  F -->|sí| H{¿Mayor de 20 MB?}
  H -->|sí| I[Desactivar la vista previa]
  H -->|no| J[Crear el documento]
  J --> K[Registrar el watcher]
  J --> L[Anotar en recientes]
  J --> M[Montar CodeMirror]
  M --> N[markdown-it renderiza]
  N --> O{¿Documento grande?}
  O -->|sí| P[Debounce de 80 ms]
  O -->|no| Q[requestAnimationFrame]
  P --> R[morphdom parchea el DOM]
  Q --> R
  R --> S{¿Necesita KaTeX?}
  S -->|sí| T[Cargar KaTeX bajo demanda]
  S -->|no| U{¿Necesita Mermaid?}
  T --> U
  U -->|sí| V[Cargar Mermaid bajo demanda]
  U -->|no| W{¿Hay código con lenguaje?}
  V --> W
  W -->|sí| X[Cargar highlight.js]
  W -->|no| Y[Reconstruir el mapa de líneas]
  X --> Y
  Y --> Z[Vista previa lista]
  K --> AA{¿Cambió en disco?}
  AA -->|documento limpio| AB[Recargar en silencio]
  AA -->|documento sucio| AC[Ofrecer recargar o conservar]
  AB --> Z
  AC --> Z
```

Con el diagrama tan ancho, en la vista previa se ve diminuto. El botón de ampliar
lo abre en el visor, donde se puede acercar, arrastrar y guardar como imagen.
