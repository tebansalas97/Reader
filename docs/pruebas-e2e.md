# Pruebas de extremo a extremo

Estas pruebas arrancan Reader de verdad, con su ventana y su WebView, y lo
manejan por WebDriver. Sirven para lo que las pruebas de componente no ven: que
la aplicación arranca, que el documento llega hasta la pantalla y que un gesto
del ratón acaba en una anotación.

## Qué hace falta

1. `tauri-driver`, que hace de puente:

   ```
   cargo install tauri-driver --locked
   ```

2. `msedgedriver.exe` de la **misma versión** que el WebView2 instalado, en
   `tools/`. La versión se mira así:

   ```powershell
   (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}').pv
   ```

   Y se descarga de `https://msedgedriver.microsoft.com/<versión>/edgedriver_win64.zip`.
   La carpeta `tools/` no va al repositorio.

3. El ejecutable compilado:

   ```
   npm run build:app
   ```

## Cómo se ejecutan

```
npm run e2e
```

Si falta alguna de las tres cosas de arriba, el guion lo dice y sale con código 2
en vez de fallar a medias.

## Cómo se le da un documento a la aplicación

No por la línea de órdenes: el controlador añade sus propias opciones al arrancar
el ejecutable y el documento no llega. En su lugar, el guion escribe la sesión en
las preferencias antes de arrancar (`restoreSession` y `session`), que es
justamente la función de recuperar la sesión, y así prueba dos cosas a la vez.

Las preferencias del usuario se copian a `prefs.e2e-backup.json` antes de tocarlas
y se devuelven al terminar, pase lo que pase. Si una ejecución se corta a lo
bruto, la siguiente ve la copia y la restaura antes de empezar.

Durante las pruebas el autoguardado se apaga, para que un trazo de prueba no
acabe escrito en el PDF de ejemplo.

## Qué comprueban hoy

- La sesión se recupera y el PDF aparece en una pestaña.
- La primera página se dibuja en su lienzo.
- El visor tiene páginas y las miniaturas son doce.
- Las herramientas se encienden y se apagan.
- El modo de lectura cambia.
- La barra de estado dice por qué página va.
- Un arrastre con la herramienta de dibujo deja un trazo, y ese trazo sale en el
  panel de notas.
