# RustyBros

Editor de video de escritorio y juego de plataformas: **RB1 a RB10** del proyecto Tauri + Rust + Phaser 3. Interfaz en español con React, TypeScript y Vite; procesamiento real de video mediante FFmpeg, invocado exclusivamente desde Rust.

## Funcionalidades

- **RB1:** ventana con biblioteca de archivos, vista previa, controles de reproducción/audio/pantalla completa, línea de tiempo, efectos y panel de exportación.
- **RB2:** selector nativo e importación arrastrando archivos para MP4, MOV, AVI y MKV. Muestra duración, resolución, FPS, códec de video/audio y tamaño. Lee los datos con FFprobe. Los formatos/códecs incompatibles con el visor se convierten a H.264/AAC en caché.
- **RB3:** selección de inicio/fin arrastrando los extremos de la línea de tiempo, usando las flechas sobre cada extremo o editando segundos. Reproducción limitada al tramo seleccionado. El recorte es no destructivo; «Previsualizar recorte» genera el tramo con Rust.
- **RB4:** blanco y negro, sepia, desenfoque, nitidez, pixelado y glitch. Se pueden combinar; se aplican en el orden en que se seleccionaron. «Aplicar efectos» procesa el tramo original en Rust y muestra el MP4 resultante con audio. Nunca se encadenan sobre una copia ya procesada.

- **RB5:** exportación real del recorte y los efectos seleccionados a MP4 (H.264/AAC), WebM (VP9/Opus) o GIF animado. Selector nativo de destino, calidad ligera/equilibrada/alta, resolución original o altura 480p/720p/1080p/2160p y FPS 12/15/24/25/30/50/60. Conserva la proporción del video. GIF no contiene audio; su calidad ajusta la paleta a 64/128/256 colores.
- **RB6:** barra de progreso y tiempo procesado, alimentados por `-progress pipe:1` de FFmpeg y eventos `export-progress` emitidos desde Rust. Cada trabajo lleva su propio identificador. El progreso es creciente y llega a 100% solamente después de guardar el archivo correctamente. Los errores permiten reintentar.
- **RB7:** nivel completo «El sendero del óxido», embebido con Phaser 3. Tiene desplazamiento de cámara, plataformas, tres pozos, 24 monedas, cuatro enemigos patrullando y bandera de llegada. Se pueden vencer enemigos saltando sobre ellos. Incluye victoria, derrota, pausa y reinicio.
- **RB8:** gravedad, colisiones y salto de altura variable (soltar la tecla corta el ascenso). El salto admite una pequeña tolerancia al salir de una plataforma y al pulsar antes de aterrizar. Sprites locales con animaciones de reposo, carrera, ascenso, caída y daño; enemigos caminando y monedas girando. Reaparición con breve invulnerabilidad y posta intermedia.
- **RB9:** HUD con puntaje, tres vidas, monedas, cuenta regresiva de tres minutos por vida y duración del escudo. Una moneda suma 100 puntos, vencer un enemigo suma 200 y llegar a la bandera suma 1000 más cinco puntos por segundo restante. Caer, chocar sin protección o agotar el tiempo consume una vida; el tiempo y el escudo se detienen en pausa. Reaparecer conserva los objetos recogidos y el puntaje; reiniciar vuelve a armar el nivel.
- **RB10:** Rust emite `filter-applied` y `video-exported` solamente después de completar cada operación. Aplicar efectos otorga 100 puntos, una moneda y ocho segundos de escudo; exportar otorga 500 puntos, cinco monedas y quince segundos. Los premios llegan al HUD también con el juego en pausa o antes de iniciarlo. Se ignoran eventos repetidos e inválidos. Previsualizar solamente el recorte, cancelar el selector o un procesamiento fallido no otorga premios.

La exportación usa una copia de los ajustes al iniciarla: cambiar el editor después no altera ese trabajo. Se permite una exportación a la vez y el juego sigue disponible durante el procesamiento. Los videos importados están protegidos contra reemplazo. El resultado se procesa en un temporal de la carpeta elegida y se publica al finalizar; si falla, se elimina el temporal y se conserva cualquier archivo de destino anterior. Cancelar el selector no inicia una exportación. La cancelación de una exportación que ya comenzó no está incluida.

Los requisitos RB11 a RB14 quedan para próximas etapas: eventos del juego hacia el editor, estado de juego compartido en Rust y empaquetado/instaladores. Las recompensas actuales se mantienen en memoria durante la sesión de la ventana, incluso al reiniciar el nivel; se borran al cerrar o recargar la aplicación. Los escudos no se acumulan ni acortan uno más largo: se conserva la mayor duración restante. Bloquean un choque lateral y vencen al enemigo, pero no evitan caídas ni el límite de tiempo.

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
npm test         # edición, reglas del juego y conexión de eventos
npm run test:game # interfaz, física real de Phaser y recorrido hasta la bandera
npm run test:rust # efectos y exportación real de los tres formatos, ajustes y progreso
```

El visor usa espacio para reproducir/pausar cuando el foco no está en un control. Las flechas sobre los extremos ajustan el recorte de a 0,1 s. «Restablecer edición» vuelve al clip completo sin efectos. Importar otro video agrega un archivo a la biblioteca; cambiar de clip reinicia su edición.

Para jugar, bajá al panel del juego o usá «JUGAR» en la biblioteca. Pulsá «Empezar aventura» y usá flechas o A/D para caminar; espacio, W o flecha arriba para saltar (mantené la tecla para saltar más alto); P/Esc para pausar y R para reiniciar. El teclado del juego funciona solamente con el foco dentro de su área; al volver al editor o cambiar de ventana queda en pausa. Llegar a la bandera completa el nivel; las monedas son opcionales. «Reaparecer» continúa con las vidas restantes desde el inicio o la posta. Perder permite empezar de nuevo sin afectar el video ni la exportación.

La prueba `test:game` usa Chrome o Edge instalados. Si no están disponibles, necesita el navegador administrado por Playwright (`npx playwright install chromium`). Simula el tiempo de la física para verificar el recorrido sin depender de la velocidad de renderizado del equipo.

## Arquitectura

```text
src/App.tsx                Interfaz, reproducción y selección no destructiva
src/editor.ts              Tipos, límites de recorte y formato de metadatos
src/styles.css             Diseño adaptable
src/features.css           Estilos del panel de exportación y del juego
src/components/ExportPanel.tsx Ajustes, selector de destino y eventos de progreso
src/components/GamePanel.tsx   Ciclo de vida de Phaser y controles del nivel
src/game/level.ts           Mapa, monedas y rutas de enemigos
src/game/createGame.ts      Escena Phaser, controles y física Arcade
src/game/rules.ts           Vidas, reloj, puntaje y registro de recompensas por sesión
src/game/editorBridge.ts    Suscripción y validación de eventos nativos
src/game/textures.ts        Hojas de sprites y animaciones dibujadas localmente
src/game/scenery.ts         Fondo, plataformas, posta y bandera
src-tauri/src/video.rs     Commands import_video / apply_effects, FFprobe y FFmpeg
src-tauri/src/processing.rs Ejecución de FFmpeg y filtros de vista previa
src-tauri/src/encoding.rs   Configuración de formatos y lectura del progreso real
src-tauri/src/export.rs     Command export_video, validaciones y guardado final
src-tauri/src/editor_events.rs Eventos de éxito del editor para el juego
src-tauri/tests/            Pruebas de efectos y exportaciones con video real
src-tauri/src/lib.rs       Estado de biblioteca, registro IPC y caché
src-tauri/capabilities/    Permiso mínimo para el selector nativo
scripts/tauri.mjs          Lanzador con soporte de herramientas portátiles
scripts/test-game.mjs      Prueba del HUD y recorrido con la física real de Phaser
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
10. Comprobar animaciones y altura del salto al mantener/soltar la tecla. Perder vidas por choque, caída y tiempo; activar la posta y comprobar la reaparición. El HUD debe conservar el puntaje y los objetos recogidos al perder una vida.
11. Aplicar efectos y exportar con el juego listo o pausado. Confirmar los premios y el escudo sin reanudar el reloj. Reiniciar conserva los premios del editor. Chocar lateralmente con escudo debe vencer al enemigo sin quitar una vida; un fallo del editor no debe premiar.

Los commits de RB1–RB7 fueron realizados por el usuario. Los cambios de RB8–RB10 se dejan sin commit.

## Verificación realizada

- Compilación de TypeScript/Vite y ejecutable Tauri de Windows en modo debug sin instalador.
- Trece pruebas del frontend y cuatro pruebas de Rust, incluida la generación y decodificación de seis videos con efectos y exportación MP4/WebM/GIF con recorte, resolución, FPS, audio y progreso comprobados.
- Revisión de interfaz en escritorio y móvil, sin errores de consola ni desbordes horizontales.
- Pruebas de arrastre de extremos, teclado, campos de rango, selección combinada de efectos y restablecimiento.
- Prueba de extremo a extremo en el WebView2 real de Tauri: importación de MP4, MOV, AVI y MKV, reproducción, los seis efectos por separado, una combinación y reproducción del recorte de dos segundos.
- Rechazo de archivo corrupto y de intentos de procesar un archivo que no fue importado.
- Interfaz de exportación conectada al backend Tauri real, con selector de destino simulado: los tres formatos, progreso creciente, final en 100%, cancelación del selector y protección del original.
- Fallo real del codificador: conservación del destino anterior y eliminación del temporal.
- Juego respondiendo en el WebView2 real durante una exportación 1080p/60 FPS; rechazo de trabajos simultáneos y exportación posterior sin audio.
- Nivel recorrido de principio a fin con la física de Phaser y saltos reales; monedas, enemigo vencido, caída, pausa y reinicio verificados.
- Reglas de vidas, puntaje, reloj, escudo y recompensas: validación, deduplicación, premios en pausa y limpieza de listeners.
- WebView2 real: premios después de procesar efectos y exportar, sin premios por recorte solo, fallos ni eventos repetidos; reloj/escudo congelados en pausa y premios conservados al reiniciar.

Captura del HUD y las recompensas en la aplicación: [RB8–RB10](docs/rb8-rb10.png).

Las pruebas de interacción usan selectores simulados en navegador y el evento de arrastre en Tauri. El procesamiento y los eventos de exportación de la prueba son reales. La selección dentro de los diálogos nativos se realiza manualmente.
