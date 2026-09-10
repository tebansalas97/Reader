# Distribución

Este documento recoge lo que hace falta para publicar Reader y lo que queda
pendiente porque depende de decisiones o de compras que solo puede hacer el autor.

## Lo que ya está

- El instalador se genera con `npm run build:app` (NSIS, instalación por usuario).
- La licencia es Apache 2.0 con el aviso de reconocimiento en `NOTICE`.
- `THIRD-PARTY.md` se regenera con `npm run licenses`.
- La ventana «Acerca de» enseña la versión, el autor, la licencia y un enlace a
  la página de versiones del repositorio.

## Firmar el instalador (pendiente, hace falta comprar un certificado)

Windows enseña un aviso de SmartScreen a todo instalador sin firmar. Para
quitarlo hace falta un certificado de firma de código (OV o EV) de una autoridad
reconocida. Es una compra anual y solo la puede hacer el autor.

Cuando exista el certificado:

1. Guardarlo en el equipo como `.pfx` y **no** meterlo en el repositorio.
2. Poner en el entorno `TAURI_WINDOWS_SIGN_COMMAND` o rellenar en
   `src-tauri/tauri.conf.json` el bloque `bundle.windows`:
   `certificateThumbprint`, `digestAlgorithm: "sha256"` y `timestampUrl`.
3. Volver a compilar. El instalador queda firmado y el aviso desaparece
   (con un certificado OV tarda unas semanas en ganar reputación; con uno EV es
   inmediato).

## Actualización automática (pendiente, hace falta una clave y un sitio donde publicar)

Reader todavía no se actualiza solo. Hoy, «Acerca de» lleva a la página de
versiones para descargar la nueva a mano.

Para encenderla hacen falta dos cosas que dependen del autor: una clave de firma
de actualizaciones y un sitio donde publicar el archivo que las anuncia.

1. Generar el par de claves:

   ```
   npm run tauri signer generate -- -w %USERPROFILE%\.tauri\reader.key
   ```

   La clave privada no se sube al repositorio nunca. La pública se pega en la
   configuración.

2. Añadir el complemento:

   ```
   npm run tauri add updater
   ```

   Eso agrega `tauri-plugin-updater` en Rust, `@tauri-apps/plugin-updater` en
   JavaScript y el permiso `updater:default` en `src-tauri/capabilities/default.json`.

3. En `src-tauri/tauri.conf.json`, dentro de `plugins`:

   ```json
   "updater": {
     "pubkey": "LA CLAVE PUBLICA",
     "endpoints": ["https://github.com/<usuario>/reader/releases/latest/download/latest.json"]
   }
   ```

   Y en `bundle`: `"createUpdaterArtifacts": true`.

4. Al compilar, poner en el entorno `TAURI_SIGNING_PRIVATE_KEY` (y su contraseña
   si la tiene). La compilación deja el instalador, su firma y `latest.json`.
   Los tres se suben a la versión de GitHub.

5. En la aplicación, comprobar al arrancar:

   ```ts
   import { check } from '@tauri-apps/plugin-updater';
   const update = await check();
   if (update) await update.downloadAndInstall();
   ```

   Conviene preguntar antes de instalar y respetar una preferencia para
   desactivarlo.

**Por qué no está hecho ya:** el complemento arrastra un cliente HTTP completo al
binario, y sin clave ni versiones publicadas no serviría de nada. En cuanto
existan el repositorio público y la clave, son los cinco pasos de arriba.

## Idiomas

La interfaz está en español e inglés. Los textos viven en `src/lib/i18n.ts`, en
dos diccionarios con las mismas claves; añadir un idioma es añadir un tercer
diccionario y una opción en las preferencias. No se han añadido más idiomas a
propósito: traducir cuatrocientas cadenas sin nadie que las revise deja una
interfaz peor que la que hay.
