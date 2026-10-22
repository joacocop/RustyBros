# Instalar y compilar RustyBros

## Windows x64

Abrir `RustyBros_0.1.0_x64-setup.exe` y seguir el asistente. Se instala para el
usuario actual y crea un acceso en **Inicio > RustyBros**. Al finalizar, la
opción de ejecutar RustyBros abre el editor y su juego embebido en la misma ventana.
No se necesitan Node.js, Rust, un servidor ni FFmpeg instalado por separado.

Se necesita Windows 10/11 con Microsoft Edge WebView2. El instalador incluye
el bootstrapper oficial; si el runtime falta, necesita internet para instalarlo.
El paquete de esta etapa no tiene firma de editor. `SHA256SUMS.txt` permite
comparar la huella del instalador recibido con la de la compilación.

La desinstalación está disponible en **Configuración > Aplicaciones > RustyBros**.
No elimina los videos originales ni las exportaciones del usuario. Los logros
y recompensas se conservan en memoria durante la sesión, sin guardado en disco.

## Linux x64

La compilación nativa genera `.deb` y `.AppImage`. El `.deb` declara las
dependencias WebKitGTK y GStreamer de reproducción de video. La AppImage incluye
el framework multimedia y requiere un sistema compatible con Ubuntu 22.04 o
posterior y FUSE 2; sus bibliotecas base dependen del sistema de compilación.

Para instalar el `.deb`, utilizar el instalador de paquetes del sistema o
`sudo apt install ./RustyBros_0.1.0_amd64.deb` (usar el nombre real del archivo).
Para la AppImage, darle permiso de ejecución y abrirla. Ambas inician el editor
con el juego integrado y llevan sus propios FFmpeg y FFprobe.

## macOS Intel y Apple Silicon

Se genera un `.dmg` por arquitectura, además del `.app`. Abrir el DMG y arrastrar
RustyBros a **Aplicaciones**; abrir esa aplicación inicia el editor y el juego
integrado. Seleccionar x64 para Intel y arm64/aarch64 para Apple Silicon.

La compilación preparada usa firma ad hoc, sin cuenta de Apple, certificado de
distribución ni notarización. Para distribución pública verificada por Gatekeeper
se deben configurar firma Developer ID y notarización en el entorno de macOS;
no se incluyen credenciales en este proyecto.

## Generar paquetes

En cada sistema y arquitectura nativos, instalar los requisitos de Tauri 2,
Node.js 22 y Rust estable; luego ejecutar:

```text
npm ci
npm run tauri -- build
npm run collect:artifacts
```

En Windows, esta carpeta también admite la instalación GNU portátil en `.tools/`.
El empaquetado incluye `WebView2Loader.dll` cuando el ejecutable GNU lo necesita;
MSVC enlaza el loader estáticamente. La preparación rechaza combinaciones de
arquitectura/sistema distintas del host para no mezclar herramientas multimedia
de un sistema con una aplicación para otro.

`beforeBuildCommand` prepara FFmpeg, FFprobe, sus licencias y sus huellas antes
de compilar. Los recursos se resuelven con `AppHandle.path().resource_dir()`;
no dependen del directorio desde el que se abra la aplicación. En macOS se usa
el directorio Resources del `.app`; en Linux el directorio de recursos del paquete.
Se conservan las variables `RUSTYBROS_FFMPEG` y `RUSTYBROS_FFPROBE` para un binario
propio. Para empaquetar un FFmpeg propio debe incluirse `.LICENSE` y `.README`
junto a ese ejecutable, documentando licencia, fuentes y configuración.

Los paquetes se generan en `src-tauri/target/release/bundle/`. El recolector los
copia a `artifacts/`, junto a `SHA256SUMS.txt`, los avisos de terceros, esta guía
y `build-info.json` con versión, commit de base, estado del árbol y manifiesto.
No agregar `artifacts/` ni los ejecutables generados al código fuente.

## Compilación en GitHub Actions

El workflow manual **Instaladores de escritorio** está en
`.github/workflows/desktop-packages.yml`. Tras incorporar el código al repositorio,
abrir **Actions > Instaladores de escritorio > Run workflow**. Crea cuatro
trabajos independientes: Windows x64, Ubuntu 22.04 x64, macOS Intel y macOS ARM64.
Cada trabajo ejecuta las pruebas y genera sus paquetes en su propio sistema.
Los resultados se descargan como artifacts del workflow durante 14 días.

El workflow no crea releases ni publica versiones y no se ejecuta automáticamente
al hacer push. No requiere tokens de publicación. Firma comercial y notarización
quedan a cargo del entorno de distribución con sus certificados correspondientes.

## Comprobación de instalación en Windows

```text
npm run test:installer
```

Requiere el instalador NSIS generado y WebView2. Se niega a reemplazar una
instalación existente de RustyBros. Instala una copia en una carpeta temporal
del proyecto con espacios en el nombre, verifica archivos y acceso de Inicio,
ejecuta el editor desde otra carpeta con un PATH de Windows mínimo, e importa,
aplica efectos, exporta y comprueba el juego y los logros. Al finalizar desinstala
solamente esa copia; el instalador original queda disponible. Necesita el puerto
de diagnóstico 9223 libre y produce `docs/rb13-rb14.png`.

La prueba utiliza recursos y procesamiento reales. No requiere Vite, Node o Rust
en el entorno del proceso instalado. El diagnóstico remoto se habilita únicamente
en el proceso de prueba mediante una variable de entorno; no queda configurado
en la aplicación distribuida.

## Componentes y fuentes

El paquete contiene `notices/THIRD_PARTY_NOTICES.md`, las licencias originales,
procedencia y configuración de FFmpeg/FFprobe y avisos de las bibliotecas de la
interfaz. `runtime/manifest.json` identifica los ejecutables exactos por SHA-256.
Consultar esas licencias y asegurar el acceso al código fuente correspondiente de
los binarios y bibliotecas GPL antes de redistribuir públicamente los paquetes.
