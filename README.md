# RustyBros

Editor de video de escritorio y juego de plataformas: **RB1 a RB7** del proyecto Tauri + Rust + Phaser 3. Interfaz en español con React, TypeScript y Vite; procesamiento real de video mediante FFmpeg, invocado exclusivamente desde Rust.

## Funcionalidades

- **RB1:** ventana con biblioteca de archivos, vista previa, controles de reproducción/audio/pantalla completa, línea de tiempo, efectos y panel de exportación.
- **RB2:** selector nativo e importación arrastrando archivos para MP4, MOV, AVI y MKV. Muestra duración, resolución, FPS, códec de video/audio y tamaño. Lee los datos con FFprobe. Los formatos/códecs incompatibles con el visor se convierten a H.264/AAC en caché.
- **RB3:** selección de inicio/fin arrastrando los extremos de la línea de tiempo, usando las flechas sobre cada extremo o editando segundos. Reproducción limitada al tramo seleccionado. El recorte es no destructivo; «Previsualizar recorte» genera el tramo con Rust.
- **RB4:** blanco y negro, sepia, desenfoque, nitidez, pixelado y glitch. Se pueden combinar; se aplican en el orden en que se seleccionaron. «Aplicar efectos» procesa el tramo original en Rust y muestra el MP4 resultante con audio. Nunca se encadenan sobre una copia ya procesada.

- **RB5:** exportación real del recorte y los efectos seleccionados a MP4 (H.264/AAC), WebM (VP9/Opus) o GIF animado. Selector nativo de destino, calidad ligera/equilibrada/alta, resolución original o altura 480p/720p/1080p/2160p y FPS 12/15/24/25/30/50/60. Conserva la proporción del video. GIF no contiene audio; su calidad ajusta la paleta a 64/128/256 colores.
- **RB6:** barra de progreso y tiempo procesado, alimentados por `-progress pipe:1` de FFmpeg y eventos `export-progress` emitidos desde Rust. Cada trabajo lleva su propio identificador. El progreso es creciente y llega a 100% solamente después de guardar el archivo correctamente. Los errores permiten reintentar.
- **RB7:** nivel completo «El sendero del óxido», embebido con Phaser 3. Tiene desplazamiento de cámara, plataformas, tres pozos, 24 monedas, cuatro enemigos patrullando y bandera de llegada. Se pueden vencer enemigos saltando sobre ellos. Incluye victoria, derrota, pausa y reinicio.

La exportación usa una copia de los ajustes al iniciarla: cambiar el editor después no altera ese trabajo. Se permite una exportación a la vez y el juego sigue disponible durante el procesamiento. Los videos importados están protegidos contra reemplazo. El resultado se procesa en un temporal de la carpeta elegida y se publica al finalizar; si falla, se elimina el temporal y se conserva cualquier archivo de destino anterior. Cancelar el selector no inicia una exportación. La cancelación de una exportación que ya comenzó no está incluida.

Los requisitos RB8 a RB14 quedan para próximas etapas. El juego incluye la física necesaria para completar RB7; todavía no se implementaron recompensas editor/juego, estado de juego compartido en Rust, HUD completo ni instaladores.

## Ejecutar

```powershell
npm install
npm run tauri dev
```

La primera compilación descarga los crates de Rust y puede demorar varios minutos. Se necesita Node.js 22, Rust estable y las herramientas de compilación de Tauri para el sistema operativo. En Windows también se requiere WebView2. Esta carpeta puede usar una instalación portátil en `.tools/` de Rust GNU + LLVM-MinGW: el lanzador la detecta automáticamente y configura el entorno solamente para su proceso. Si `.tools/` no está presente, usa Rust y el compilador del sistema. Para Windows con Rust MSVC se necesitan Visual Studio Build Tools con «Desarrollo para el escritorio con C++» y Windows SDK.

`npm install` descarga FFmpeg y FFprobe como dependencias de desarrollo locales. Se puede usar una instalación propia mediante `RUSTYBROS_FFMPEG` y `RUSTYBROS_FFPROBE` (rutas a los ejecutables); sin binarios locales se buscan en `PATH`. No se genera instalador en esta etapa. Para distribuir posteriormente se deberá empaquetar FFmpeg y revisar sus licencias (incluida la variante GPL de ffmpeg-static).

```powershell
npm run dev      # interfaz y juego en navegador; importación/exportación requieren Tauri
npm run build    # comprobación de TypeScript y compilación del frontend
npm test         # límites del recorte y formato del tiempo
npm run test:rust # efectos y exportación real de los tres formatos, ajustes y progreso
```

El visor usa espacio para reproducir/pausar cuando el foco no está en un control. Las flechas sobre los extremos ajustan el recorte de a 0,1 s. «Restablecer edición» vuelve al clip completo sin efectos. Importar otro video agrega un archivo a la biblioteca; cambiar de clip reinicia su edición.

Para jugar, bajá al panel del juego o usá «JUGAR» en la biblioteca. Pulsá «Empezar aventura» y usá flechas o A/D para caminar; espacio, W o flecha arriba para saltar; P/Esc para pausar y R para reiniciar. El teclado del juego funciona solamente con el foco dentro de su área; al volver al editor o cambiar de ventana queda en pausa. Llegar a la bandera completa el nivel; las monedas son opcionales. Perder permite empezar de nuevo sin afectar el video ni la exportación.

## Arquitectura

```text
src/App.tsx                Interfaz, reproducción y selección no destructiva
src/editor.ts              Tipos, límites de recorte y formato de metadatos
src/styles.css             Diseño adaptable
src/features.css           Estilos del panel de exportación y del juego
src/components/ExportPanel.tsx Ajustes, selector de destino y eventos de progreso
src/components/GamePanel.tsx   Ciclo de vida de Phaser y controles del nivel
src/game/level.ts           Mapa, monedas y rutas de enemigos
src/game/createGame.ts      Escena Phaser, texturas locales y física Arcade
src-tauri/src/video.rs     Commands import_video / apply_effects, FFprobe y FFmpeg
src-tauri/src/processing.rs Ejecución de FFmpeg y filtros de vista previa
src-tauri/src/encoding.rs   Configuración de formatos y lectura del progreso real
src-tauri/src/export.rs     Command export_video, validaciones y guardado final
src-tauri/tests/            Pruebas de efectos y exportaciones con video real
src-tauri/src/lib.rs       Estado de biblioteca, registro IPC y caché
src-tauri/capabilities/    Permiso mínimo para el selector nativo
scripts/tauri.mjs          Lanzador con soporte de herramientas portátiles
```

Las tareas pesadas se ejecutan con `spawn_blocking`, sin bloquear la ventana. Los efectos aceptan una lista cerrada de filtros: no se ejecutan comandos de shell ni filtros arbitrarios enviados por la interfaz. Rust valida archivo, extensión, existencia de video, duración y límites de recorte. Solamente los archivos importados pueden procesarse; se autoriza explícitamente cada vista previa para el protocolo de archivos de Tauri. Los resultados temporales se guardan en la caché de la aplicación y se limpian al iniciar la siguiente sesión.

## Prueba manual del avance

1. Importar un MP4 y comprobar metadatos y reproducción. Repetir con MOV, AVI y MKV (puede tardar al convertir a un formato reproducible).
2. Arrastrar inicio y fin; comprobar que no se cruzan ni exceden la duración. Ajustar con números y flechas. Reproducir para verificar el rango.
3. Previsualizar solo el recorte; comprobar duración y audio.
4. Probar cada uno de los seis efectos y una combinación. Confirmar el cambio visual y que el archivo original sigue intacto.
5. Modificar el recorte o los efectos: se vuelve al original hasta aplicar nuevamente. Restablecer y cambiar de archivo.
6. Probar un archivo corrupto o sin pista de video; debe aparecer un mensaje y permitir reintentar.
7. Elegir MP4, WebM y GIF; variar calidad, altura y FPS. Exportar y comprobar recorte, efectos, reproducción, audio y progreso. Cancelar el selector y verificar que no se crea un archivo.
8. Intentar guardar sobre un video importado: debe rechazarse. Repetir una exportación sobre un destino anterior y confirmar que se reemplaza solamente al finalizar.
9. Jugar durante una exportación. Probar monedas, enemigos, pozos, pausa al salir del juego, reinicio y llegada a la bandera.

El commit inicial de RB1–RB4 pertenece al usuario. Los cambios de RB5–RB7 se dejaron sin commit.

## Verificación realizada

- Compilación de TypeScript/Vite y ejecutable Tauri de Windows en modo debug sin instalador.
- Tres pruebas del frontend y cuatro pruebas de Rust, incluida la generación y decodificación de seis videos con efectos y exportación MP4/WebM/GIF con recorte, resolución, FPS, audio y progreso comprobados.
- Revisión de interfaz en escritorio y móvil, sin errores de consola ni desbordes horizontales.
- Pruebas de arrastre de extremos, teclado, campos de rango, selección combinada de efectos y restablecimiento.
- Prueba de extremo a extremo en el WebView2 real de Tauri: importación de MP4, MOV, AVI y MKV, reproducción, los seis efectos por separado, una combinación y reproducción del recorte de dos segundos.
- Rechazo de archivo corrupto y de intentos de procesar un archivo que no fue importado.
- Interfaz de exportación conectada al backend Tauri real, con selector de destino simulado: los tres formatos, progreso creciente, final en 100%, cancelación del selector y protección del original.
- Fallo real del codificador: conservación del destino anterior y eliminación del temporal.
- Juego respondiendo en el WebView2 real durante una exportación 1080p/60 FPS; rechazo de trabajos simultáneos y exportación posterior sin audio.
- Nivel recorrido de principio a fin con la física de Phaser y saltos reales; monedas, enemigo vencido, caída, pausa y reinicio verificados.

Las pruebas de interacción usan selectores simulados en navegador y el evento de arrastre en Tauri. El procesamiento y los eventos de exportación de la prueba son reales. La selección dentro de los diálogos nativos se realiza manualmente.
