# Componentes de terceros

RustyBros ejecuta FFmpeg y FFprobe como procesos independientes; no modifica sus binarios.
Cada instalación incluye `runtime/manifest.json` con plataforma, arquitectura, versiones
y SHA-256, y esta carpeta `notices/` con las licencias, configuración y procedencia.

## FFmpeg y FFprobe

- FFmpeg: https://ffmpeg.org/ y https://github.com/FFmpeg/FFmpeg
- Binarios de `ffmpeg-static`: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- Licencia de la compilación: `FFmpeg-LICENSE.txt` (GPL). Configuración y revisión de
  fuentes exacta: `FFmpeg-build-README.txt`; versión/configuración: `ffmpeg-version.txt`.
- FFprobe se distribuye mediante https://github.com/joshwnj/ffprobe-static.
  El wrapper JavaScript es MIT (`ffprobe-static-wrapper-LICENSE.txt`); esa licencia
  no reemplaza la licencia del binario FFprobe, que pertenece a FFmpeg.
- Versión/configuración de FFprobe: `ffprobe-version.txt`. Los binarios x64 del
  paquete son FFmpeg 4.0.2: https://ffmpeg.org/releases/ffmpeg-4.0.2.tar.xz.
  La procedencia por plataforma está en `ffprobe-static-README.txt`.
  En Apple Silicon debe consultarse la versión registrada en el manifiesto.

Los derechos de estos componentes corresponden a sus respectivos autores. La licencia
GPL y sus condiciones de redistribución, incluyendo acceso al código fuente
correspondiente de los binarios y sus bibliotecas, deben acompañar una distribución
pública. Conservar estos avisos y los documentos originales de cada compilación.
Los enlaces anteriores identifican los proyectos y fuentes; no constituyen una
oferta de soporte ni una licencia distinta de la original.

## Interfaz y plataforma

- React, React DOM y Scheduler: https://github.com/facebook/react (MIT).
- Phaser: https://github.com/phaserjs/phaser (MIT).
- EventEmitter3: https://github.com/primus/eventemitter3 (MIT).
- Lucide: https://github.com/lucide-icons/lucide (ISC).
- Tauri y sus APIs: https://github.com/tauri-apps/tauri (MIT o Apache-2.0).
- WebView2 y su loader: https://www.nuget.org/packages/Microsoft.Web.WebView2
  (licencia de Microsoft incluida en el SDK/runtime). El instalador usa el
  bootstrapper oficial de Microsoft cuando falta el runtime de WebView2.

Las licencias de los paquetes de interfaz se copian a esta carpeta durante la
preparación del instalador. `rust/components.json` enumera versiones, licencias
y fuentes de los crates disponibles de `src-tauri/Cargo.lock`; sus avisos originales
se incluyen bajo `rust/`. Esta recolección se realiza después de compilar para
que también funcione en el primer empaquetado de cada plataforma.
