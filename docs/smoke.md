# Comprobación manual antes de publicar

Lo que las pruebas automáticas no cubren, porque depende de Windows o del propio
WebView. Recorre la lista con la compilación de release instalada, no con
`tauri dev`.

## Apertura de archivos

1. Haz doble clic en un `.md` desde el Explorador. Se abre en Reader.
2. Con Reader ya abierto, haz doble clic en otro `.md`. Se abre como pestaña
   nueva en la misma ventana, sin lanzar un segundo proceso.
3. Ejecuta `reader.exe ruta\al\archivo.md` desde una consola. Reutiliza la
   ventana existente.
4. Arrastra un `.md` sobre la ventana. Se abre.
5. Abre una carpeta con `Ctrl+Shift+O`. El árbol la muestra y al hacer clic en un
   archivo se abre.

## Edición y guardado

6. Escribe en el editor. La vista previa sigue el texto sin saltos ni parpadeos.
7. Desplaza el editor. La vista previa lo sigue, y al revés.
8. Cambia de aplicación y vuelve. El autoguardado se comportó según la
   preferencia elegida.
9. Cambia el final de línea en la barra de estado y guarda. El archivo cambia en
   disco.
10. Arrastra un PNG dentro del editor. Aparece en `assets` junto al documento y
    se ve en la vista previa.
11. Copia una imagen al portapapeles y pégala en el editor. Mismo resultado.
12. Selecciona texto y pega una URL encima. Se convierte en un enlace.

## Barra de herramientas y edicion asistida

12b. Selecciona un parrafo y pulsa negrita en la barra. Se envuelve sin que el
     cursor salte a la primera linea.
12c. Escribe en mitad del documento. El cursor se queda donde estas.
12d. Sitúa el cursor en un bloque. La vista previa lo resalta con la barra azul.
12e. Haz doble clic en un parrafo de la vista previa. El cursor va a esa linea.
12f. Pulsa el boton de copiar de un bloque de codigo. El portapapeles lo tiene.
12g. Abre un diagrama con el boton de ampliar. Haz zoom con la rueda, arrastra,
     pulsa F para ajustar y guardalo en PNG y en SVG.
12h. Desmarca la casilla de sincronizacion. Los paneles dejan de seguirse.
12i. Abre la paleta con Ctrl+Shift+P, escribe "tabla" y pulsa Enter.
12j. Copia texto con formato de una pagina web y pegalo. Llega como Markdown.
12k. Aumenta y reduce el texto con Ctrl+ y Ctrl-, y restauralo con Ctrl+0.
12l. Haz doble clic en una palabra del editor. Se selecciona esa palabra sola.
12m. Haz triple clic en una frase. Se selecciona la frase sin el salto de linea.
12n. Selecciona unas palabras. La vista previa las marca exactamente.
12o. Pon el cursor en un elemento de una lista. Solo se resalta ese elemento.
12p. Marca una casilla desde la vista previa. El archivo pasa de [ ] a [x] y el
     editor lo refleja.
12q. Mueve una linea con Alt+Arriba y Alt+Abajo, duplicala con Ctrl+Shift+D y
     borrala con Ctrl+Shift+K.

## Cambios desde fuera

13. Con el documento sin modificar, edítalo en el Bloc de notas y guarda. Reader
    lo recarga solo, conservando la posición.
14. Modifica el documento en Reader sin guardar, edítalo también en el Bloc de
    notas y guarda allí. Aparece la barra con dos opciones. Prueba las dos.
15. Borra el archivo abierto desde el Explorador. El documento se desliga con un
    aviso y el texto sigue ahí.

## Cierre

16. Cierra una pestaña con cambios sin guardar. El diálogo ofrece guardar,
    descartar y cancelar. Prueba los tres.
17. Cierra la ventana con dos documentos modificados. Pregunta una vez por cada
    uno. Cancelar en cualquiera detiene el cierre.

## Apariencia

18. Cambia el tema de Windows entre claro y oscuro con la preferencia en «Del
    sistema». La app lo sigue al momento.
19. Fija el tema en claro y en oscuro desde Preferencias. Manda sobre el del
    sistema.
20. Reduce la ventana a 640 por 400. Nada se solapa y no aparece scroll
    horizontal en la página.
21. Entra en modo zen con `F11` y sal con `Escape`.

## Contenido enriquecido

22. Abre `tests/fixtures/demo.md`. Se ven el resaltado de código, las dos
    fórmulas y el diagrama.
23. Escribe un bloque `mermaid` con sintaxis inválida. Muestra el error dentro
    del bloque sin romper el resto del documento.

## Exportación

24. Exporta a HTML. Ábrelo en un navegador sin conexión: se ve igual, con las
    imágenes incrustadas.
25. Exporta a PDF desde el diálogo de impresión. La interfaz no aparece en el
    resultado.
