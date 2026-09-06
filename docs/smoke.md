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
