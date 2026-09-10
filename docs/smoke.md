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

## Herramientas de escritura

12r. Abre una carpeta y pulsa Ctrl+Shift+F. Escribe una palabra que este en
     varios archivos. Los resultados salen agrupados y al pulsar uno se abre el
     archivo en esa linea.
12s. Activa el corrector en Preferencias. Aparece Corrector activo en la barra
     de estado y las palabras mal escritas se subrayan en rojo.
12t. Pulsa el boton derecho sobre una palabra subrayada. Salen sugerencias y la
     opcion de anadirla al diccionario.
12u. Cambia el idioma del corrector a ingles. El subrayado cambia de parrafo.
12v. Activa el modo foco desde la barra de herramientas. Todo lo que no es el
     bloque activo se atenua.
12v2. Pasa el raton por un enlace de la vista previa. El aviso dice a donde va:
      ruta completa, seccion del documento o direccion web.
12w. Activa el modo maquina de escribir. La linea activa se queda centrada.
12x. Pon el cursor en una tabla y pulsa Tab. Salta a la celda siguiente.
12y. Guarda un documento con una tabla desalineada. Las columnas se alinean.
12z. Escribe [[nombre]] y mira la vista previa. Es un enlace; al pulsarlo abre
     nombre.md de la misma carpeta.
12aa. Guarda dos veces separadas por mas de treinta segundos y abre el panel de
      historial. Hay dos versiones y se pueden ver y restaurar.
12ab. Edita prefs.json con el Bloc de notas y guardalo con BOM. Los ajustes
      siguen respetandose.

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

## PDF

26. Genera el documento de prueba con `node scripts/make-pdf-fixtures.mjs` y
    abre `tests/fixtures/prueba.pdf`. La primera página aparece ajustada al
    ancho y arriba del todo, no desplazada.
27. Gira la página con los botones de la barra. El contenido gira con la caja,
    no solo la caja.
28. Aleja el zoom con `Ctrl` y la rueda. Las páginas se quedan centradas y
    ninguna se ve de otro tamaño.
29. Selecciona texto con el ratón. La selección sigue las líneas del documento.
30. Con la herramienta de resaltar activa, selecciona una frase y suéltala. El
    resaltado aparece encima del texto y la barra de estado pasa a «Sin
    guardar».
31. Prueba subrayar, tachar, el lápiz, la nota, el rectángulo y la elipse.
32. Pulsa sobre una marca. Se abre el globo: cambia el color, escribe un
    comentario y ciérralo con `Escape`.
33. Selecciona una marca y pulsa `Supr`. Desaparece al momento.
33b. Selecciona una marca y arrástrala. Se mueve con el ratón y se queda
    donde la sueltas. Con las flechas se mueve punto a punto, y con
    `Mayús` diez a la vez.
33c. Arrastra una esquina del recuadro de selección. La marca se estira.
    En un resaltado, un subrayado, un tachado o un dibujo aparece además
    un tirador redondo arriba para girarla.
33d. Abre la pestaña de notas en la barra lateral. Están todas, agrupadas
    por página y con el texto que hay debajo de cada resaltado. Pulsa una
    y el visor salta a ella.
34. Guarda con `Ctrl+S`. Aparece «Anotaciones guardadas» y la barra vuelve a
    «Guardado».
35. Cierra la pestaña y vuelve a abrir el archivo. Las anotaciones siguen ahí,
    en el mismo sitio y del mismo color.
36. Guarda otra vez sin tocar nada y vuelve a abrir. No hay anotaciones
    duplicadas.
37. Abre en Edge y en Acrobat el PDF que acabas de guardar. Las marcas se ven
    igual que en Reader: resaltado, subrayado, tachado, dibujo, nota,
    rectángulo y elipse. Esta es la prueba de que las anotaciones son de
    verdad del archivo y no un dibujo de Reader.
38. Abre en Reader un PDF con formulario o con sellos, anótalo y guárdalo. Lo
    que Reader no entiende sigue viéndose y sigue en el archivo.
39. Guarda dos veces seguidas. La barra de estado se queda en «Guardado» y no
    vuelve a «Sin guardar» sola: guardar no puede parecer un borrado del
    archivo.
40. `Ctrl+Shift+S` sobre un PDF ofrece guardar como `.pdf`, no como `.md`, y el
    documento pasa a apuntar al archivo nuevo.
41. `Ctrl+P` sobre un PDF imprime todas las páginas del documento, no lo que se
    ve en pantalla, y con las anotaciones ya guardadas.
42. `Ctrl+P` sobre un Markdown imprime el documento entero, sin la barra de
    herramientas y sin cortar en la primera hoja.
43. Exportar a HTML está en gris cuando el documento activo es un PDF.

## Organizar páginas

44. Abre un PDF y ve a la pestaña de páginas en la barra lateral. Pulsa una
    miniatura: el visor salta a ella y queda seleccionada.
45. Con `Ctrl` añade otra a la selección; con `Mayús` toma el rango entero.
46. Gira una página seleccionada. Gira la miniatura y también la página en el
    visor, no solo la vista.
47. Arrastra una miniatura a otro sitio. Aparece la línea de destino, y al
    soltar el documento se reordena en el visor.
48. La barra de estado pasa a «Sin guardar» en cuanto se toca el orden.
49. Quita una página que tenga anotaciones. Avisa de cuántas se van a perder
    antes de hacerlo.
50. Guarda. Vuelve a abrir el archivo: el orden, los giros y las anotaciones
    que quedaron están como los dejaste, y las anotaciones siguen sobre su
    página aunque la página haya cambiado de sitio.
51. Selecciona dos páginas y extráelas. El archivo nuevo tiene solo esas dos,
    con sus anotaciones.
52. Cierra la app con la pestaña de páginas abierta y vuelve a abrirla: sigue
    en la misma pestaña.

## Formularios y firma

53. Abre un PDF con formulario. Los campos aparecen con su recuadro azul:
    escribe en uno, marca una casilla, elige una opción de una lista.
54. La barra de estado pasa a «Sin guardar» al tocar cualquier campo.
55. Guarda y vuelve a abrir el archivo. Los valores siguen ahí. Ábrelo también
    en Edge: se ven igual, porque van escritos en el formulario del PDF y con
    su apariencia.
56. Un campo de solo lectura se ve con el borde a rayas y no deja escribir.
57. Un botón del formulario (los que ejecutan acciones) no se puede pulsar:
    Reader no ejecuta el JavaScript de un PDF.
58. Pulsa el botón de la firma en la barra. Dibuja tu firma y pulsa «Usar esta
    firma»: el puntero queda armado. Pulsa en el documento donde quieras y la
    firma aparece ahí.
59. La firma se puede mover, estirar y girar como cualquier dibujo, y se guarda
    dentro del PDF.
60. Cierra la app y vuelve a abrirla: tu firma sigue en el catálogo y el botón
    la vuelve a ofrecer sin tener que dibujarla otra vez.
61. En el catálogo, escribe tu nombre y guárdalo: aparece como una firma con
    letra manuscrita, lista para colocar.
62. Importa un PNG. Se guarda en el catálogo con el nombre del archivo, que se
    puede cambiar ahí mismo.
63. Coloca el PNG en el documento. Se puede mover, estirar por las esquinas y
    girar con el tirador redondo, igual que un dibujo.
64. Guarda y vuelve a abrir. La imagen sigue en su sitio, y también se ve en
    Edge. Ahí ya no se puede mover: pasa a ser parte del archivo. Sí se puede
    seleccionar y borrar.
65. Guarda dos veces seguidas: la imagen no se duplica.

## Exportar a PDF

66. Abre un Markdown y pulsa `Ctrl+Alt+P`. Elige dónde guardarlo: el PDF se
    escribe solo, sin pasar por el diálogo de impresión.
67. Ábrelo: tiene el mismo formato que la vista previa, el texto se puede
    seleccionar y los enlaces llevan su dirección al lado.
68. Con un PDF abierto, «Exportar a PDF» y «Exportar a HTML» están en gris.
69. Desde la consola: `reader.exe documento.md --export-pdf salida.pdf` escribe
    el archivo y cierra la app.
