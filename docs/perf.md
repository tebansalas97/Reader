# Rendimiento

Medido el 2026-09-10 14:10 en MESA.
Mediana de 5 arranques en frio por documento.

## Tamano en disco

| Artefacto | Presupuesto | Medido |
| --- | --- | --- |
| Instalador NSIS | menos de 15 MB | 4.7 MB |
| Ejecutable | sin presupuesto | 7.1 MB |

## Arranque

| Documento | Presupuesto | Mediana | Minimo | Maximo |
| --- | --- | --- | --- | --- |
| Vacio | menos de 600 ms | 27 ms | 22 ms | 64 ms |
| 100 KB | menos de 600 ms | 25 ms | 24 ms | 39 ms |
| 5 MB | menos de 800 ms | 25 ms | 20 ms | 28 ms |

El tiempo va desde lanzar el proceso hasta que la ventana acepta entrada.

## Memoria

| Documento | Conjunto de trabajo | Memoria privada | Sobre el suelo |
| --- | --- | --- | --- |
| Vacio | 434.9 MB | 254.1 MB | |
| 100 KB | 549.4 MB | 372.3 MB | +118.2 MB |
| 5 MB | 769.8 MB | 594 MB | +339.9 MB |

Suma del proceso principal y de todos los procesos de WebView2 que cuelgan de el.
El conjunto de trabajo cuenta varias veces las paginas de Chromium compartidas entre
procesos, asi que la memoria privada es la cifra honesta.

Con un documento vacio la aplicacion ya consume 254.1 MB: ese es el
suelo de WebView2, que arranca siete procesos de Chromium, y lo paga cualquier
aplicacion que lo use. Ese suelo se mueve con la version del runtime que tenga
instalada Windows, asi que las cifras de dos informes con fechas distintas solo se
pueden comparar por la columna de la derecha, que es lo unico que depende de
nosotros.

Las mediciones se hacen con la sesion desactivada, para que no cuente lo que
hubiera abierto la ultima vez.
