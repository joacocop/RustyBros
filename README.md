# RustyBros

Editor de video de escritorio y juego de plataformas: **RB1 a RB14** del proyecto Tauri + Rust + Phaser 3. Interfaz en español con React, TypeScript y Vite; procesamiento real de video mediante FFmpeg, invocado exclusivamente desde Rust. Instalador de Windows generado y probado; configuración y workflow nativo de Linux/macOS preparados, pendientes de ejecución en esos sistemas.

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
- **RB11:** el juego publica su progreso mediante IPC; Rust emite `game-progress` y el editor muestra un panel de logros con nivel, estado de la partida, puntaje, vidas, monedas y tiempo. Incluye mejor puntaje, victorias y monedas recogidas entre partidas. Seis logros: primera moneda, diez monedas acumuladas, primer enemigo vencido, posta intermedia, primera victoria y victoria con tres vidas. Se desbloquean una sola vez y se conservan al reiniciar el nivel.
- **RB12:** `GameStateStore(pub Mutex<GameState>)`, registrado en Tauri con los commands `get_game_state` y `update_game_state`. Rust conserva el progreso, estadísticas, logros y registro de premios. La interfaz consulta el estado al cargar, envía los cambios del juego y escucha las actualizaciones del backend. Los trabajos de video acreditan sus premios bajo el mismo bloqueo para evitar que una actualización del juego los sobrescriba.
- **RB13:** empaquetado activado con `npm run tauri -- build`. Windows genera un instalador NSIS `.exe`, con WebView2, FFmpeg, FFprobe, iconos y avisos de componentes incluidos. Linux está configurado para `.deb`/`.AppImage` y macOS para `.app`/`.dmg` en Intel y Apple Silicon. El workflow manual de GitHub Actions ejecuta cada compilación en su sistema nativo; los paquetes de Linux/macOS todavía no fueron generados ni probados desde este equipo Windows.
- **RB14:** el instalador de Windows ofrece ejecutar RustyBros al finalizar y crea el acceso de Inicio. El punto de entrada abre directamente la ventana del editor con su juego embebido. La aplicación instalada funciona sin repositorio, Vite, Node.js, Rust ni FFmpeg en PATH. Instalación, procesamiento de video, juego y desinstalación comprobados con el paquete release real.

La exportación usa una copia de los ajustes al iniciarla: cambiar el editor después no altera ese trabajo. Se permite una exportación a la vez y el juego sigue disponible durante el procesamiento. Los videos importados están protegidos contra reemplazo. El resultado se procesa en un temporal de la carpeta elegida y se publica al finalizar; si falla, se elimina el temporal y se conserva cualquier archivo de destino anterior. Cancelar el selector no inicia una exportación. La cancelación de una exportación que ya comenzó no está incluida.

Los logros, récords y recompensas se mantienen en memoria mientras el proceso de la aplicación siga abierto, incluso al reiniciar el nivel o recargar la ventana. No hay guardado en disco: cerrar y volver a abrir la aplicación inicia una sesión nueva. Recargar la ventana comienza un nivel nuevo, conservando los logros, estadísticas, premios y duración restante del escudo; no restaura la posición del personaje. Los escudos no se acumulan ni acortan uno más largo: se conserva la mayor duración restante. Bloquean un choque lateral y vencen al enemigo, pero no evitan caídas ni el límite de tiempo.

## Instalar o generar la entrega

El instalador de Windows se encuentra en `artifacts/RustyBros_0.1.0_x64-setup.exe` después de recolectar la compilación. La carpeta incluye `SHA256SUMS.txt`, información de la compilación, instrucciones y avisos de terceros. El paquete no tiene firma de editor.

```powershell
npm run tauri -- build
npm run collect:artifacts
npm run test:installer
```

La prueba instala una copia temporal sin reemplazar instalaciones existentes, comprueba el editor/juego y el procesamiento con las herramientas del paquete, y desinstala esa copia. El instalador original queda disponible. Para Linux/macOS, usar el workflow manual **Instaladores de escritorio** tras incorporar estos cambios al repositorio; todavía no se ejecutó ni se publicaron releases. Instrucciones completas y requisitos por sistema: [distribución e instalación](docs/DISTRIBUTION.md).

## Ejecutar

```powershell
npm install
npm run tauri dev
```

La primera compilación descarga los crates de Rust y puede demorar varios minutos. Se necesita Node.js 22, Rust estable y las herramientas de compilación de Tauri para el sistema operativo. En Windows también se requiere WebView2. Esta carpeta puede usar una instalación portátil en `.tools/` de Rust GNU + LLVM-MinGW: el lanzador la detecta automáticamente y configura el entorno solamente para su proceso. Si `.tools/` no está presente, usa Rust y el compilador del sistema. Para Windows con Rust MSVC se necesitan Visual Studio Build Tools con «Desarrollo para el escritorio con C++» y Windows SDK.

`npm install` descarga FFmpeg y FFprobe como dependencias de desarrollo locales. La preparación del instalador los copia a los recursos de la aplicación junto a versiones, SHA-256 y licencias; Rust los resuelve por la ruta de recursos de Tauri. Se puede usar una instalación propia mediante `RUSTYBROS_FFMPEG` y `RUSTYBROS_FFPROBE` (rutas a los ejecutables). El modo de desarrollo y las pruebas Rust también admiten binarios de npm y `PATH`. Los avisos y procedencia se incluyen en el paquete; consultar [componentes de terceros](docs/THIRD_PARTY_NOTICES.md) y las condiciones de acceso a sus fuentes antes de redistribuir públicamente los binarios GPL.

```powershell
npm run dev      # interfaz y juego en navegador; importación/exportación requieren Tauri
npm run build    # comprobación de TypeScript y compilación del frontend
npm test         # edición, reglas del juego y conexión de eventos
npm run test:game # interfaz, física real de Phaser y recorrido hasta la bandera
npm run test:rust # efectos, exportación y estado compartido/concurrencia en Rust
```

El visor usa espacio para reproducir/pausar cuando el foco no está en un control. Las flechas sobre los extremos ajustan el recorte de a 0,1 s. «Restablecer edición» vuelve al clip completo sin efectos. Importar otro video agrega un archivo a la biblioteca; cambiar de clip reinicia su edición.

Para jugar, bajá al panel del juego o usá «JUGAR» en la biblioteca. Pulsá «Empezar aventura» y usá flechas o A/D para caminar; espacio, W o flecha arriba para saltar (mantené la tecla para saltar más alto); P/Esc para pausar y R para reiniciar. El teclado del juego funciona solamente con el foco dentro de su área; al volver al editor o cambiar de ventana queda en pausa. Llegar a la bandera completa el nivel; las monedas son opcionales. «Reaparecer» continúa con las vidas restantes desde el inicio o la posta. Perder permite empezar de nuevo sin afectar el video ni la exportación.

La prueba `test:game` usa Chrome o Edge instalados. Si no están disponibles, necesita el navegador administrado por Playwright (`npx playwright install chromium`). Simula el tiempo de la física para verificar el recorrido sin depender de la velocidad de renderizado del equipo.

Para comprobar RB11–RB12 de extremo a extremo en Windows:

```powershell
npm run tauri -- build --debug --no-bundle
npm run test:native-game
```

La prueba abre su propia instancia del ejecutable debug con el puerto de diagnóstico 9223, genera un video de prueba en `tmp/native-game/`, recorre los callbacks reales de la física, procesa efectos y exporta con FFmpeg. Comprueba los commands, eventos, premios concurrentes, seis logros, reinicio y recarga; toma una captura del panel y cierra solamente la instancia que abrió. Necesita WebView2 y el puerto 9223 libre. Las pruebas de recolección/posta/victoria colocan al personaje en posiciones controladas; `test:game` comprueba además el recorrido completo mediante saltos sin teletransportarlo.

El panel de logros también funciona en `npm run dev`, como vista de navegador con estado local. El estado protegido por Rust y el procesamiento de video requieren ejecutar Tauri.

## Arquitectura

```text
src/App.tsx                Interfaz, reproducción y selección no destructiva
src/editor.ts              Tipos, límites de recorte y formato de metadatos
src/styles.css             Diseño adaptable
src/features.css           Estilos del panel de exportación y del juego
src/components/ExportPanel.tsx Ajustes, selector de destino y eventos de progreso
src/components/GamePanel.tsx   Ciclo de vida de Phaser y controles del nivel
src/components/AchievementsPanel.tsx Logros y progreso del juego dentro del editor
src/game/GameSession.tsx    Sesión compartida por el editor y el juego
src/game/progress.ts        Contrato, cola de sincronización y vista de navegador
src/game/level.ts           Mapa, monedas y rutas de enemigos
src/game/createGame.ts      Escena Phaser, controles y física Arcade
src/game/rules.ts           Vidas, reloj, puntaje y registro de recompensas por sesión
src/game/editorBridge.ts    Commands get/update y eventos game-progress de Tauri
src/game/textures.ts        Hojas de sprites y animaciones dibujadas localmente
src/game/scenery.ts         Fondo, plataformas, posta y bandera
src-tauri/src/video.rs     Commands import_video / apply_effects, FFprobe y FFmpeg
src-tauri/src/processing.rs Ejecución de FFmpeg y filtros de vista previa
src-tauri/src/encoding.rs   Configuración de formatos y lectura del progreso real
src-tauri/src/export.rs     Command export_video, validaciones y guardado final
src-tauri/src/editor_events.rs Eventos de éxito del editor para el juego
src-tauri/src/game.rs       Mutex<GameState>, commands, logros y premios atómicos
src-tauri/tests/            Video real y estado compartido con varios hilos
src-tauri/src/lib.rs       Estado de biblioteca, registro IPC y caché
src-tauri/capabilities/    Permiso mínimo para el selector nativo
scripts/tauri.mjs          Lanzador con soporte de herramientas portátiles
scripts/test-game.mjs      Prueba del HUD y recorrido con la física real de Phaser
scripts/test-native-game.mjs Prueba de juego/editor/estado en WebView2 real
scripts/prepare-bundle.mjs Binarios multimedia nativos, licencias y manifiesto
scripts/prepare-notices.mjs Avisos de crates Rust después de compilar
scripts/collect-artifacts.mjs Instaladores, SHA-256 y documentación de entrega
scripts/test-installer.mjs Instalación, arranque y desinstalación con entorno limpio
src-tauri/tauri.*.conf.json Configuración de instaladores por sistema operativo
.github/workflows/desktop-packages.yml Compilación nativa manual de cuatro destinos
```

Las tareas pesadas se ejecutan con `spawn_blocking`, sin bloquear la ventana. Los efectos aceptan una lista cerrada de filtros: no se ejecutan comandos de shell ni filtros arbitrarios enviados por la interfaz. Rust valida archivo, extensión, existencia de video, duración y límites de recorte. Solamente los archivos importados pueden procesarse; se autoriza explícitamente cada vista previa para el protocolo de archivos de Tauri. Los resultados temporales se guardan en la caché de la aplicación y se limpian al iniciar la siguiente sesión.

## Sincronización del juego

La física y las animaciones siguen en Phaser. Cuando cambia el HUD (monedas, enemigos, vidas, pausa, victoria y reloj aproximadamente cada segundo), la sesión envía una instantánea a Rust. El editor recibe el evento `game-progress` con el estado confirmado. Se registra el listener antes de consultar el estado inicial y se descartan revisiones antiguas. Los envíos se ejecutan en orden y agrupan los ticks pendientes, conservando el resultado final de cada partida antes de un reinicio. Un fallo muestra «Reintentar conexión» y conserva los envíos pendientes.

| Command | Argumentos | Resultado |
| --- | --- | --- |
| `get_game_state` | Sin argumentos | Estado actual, revisión, partida, HUD, premios, logros y estadísticas. |
| `update_game_state` | `update: { action: "startRun", runId: UUID }` | Inicia una partida con tres vidas; conserva premios, duración del escudo, récords y logros. Repetir el mismo identificador activo no reinicia otra vez. |
| `update_game_state` | `update: { action: "progress", runId, sequence, acknowledgedRewardRevision, progress }` | Valida y guarda progreso de la partida activa. Ignora secuencias repetidas/antiguas y rechaza partidas anteriores. |

`progress` contiene `gameplayScore`, `level`, `lives`, `collectedCoins`, `defeated`, `timeLeft`, `shieldSeconds`, `checkpoint` y `status`. El puntaje enviado excluye los bonos del editor; Rust suma su propio registro de premios y calcula las monedas totales. Así un envío capturado antes de terminar una exportación no borra su recompensa. `acknowledgedRewardRevision` indica qué premios recibió Phaser: Rust conserva el escudo pendiente hasta que el juego los confirme. Después permite reflejar su consumo y cuenta regresiva. Los logros se calculan en Rust a partir del progreso aceptado; los ticks y los eventos duplicados no vuelven a sumar monedas históricas ni victorias.

El mutex se libera antes de emitir eventos o procesar video. No se ejecutan FFmpeg ni cálculos de física dentro del bloqueo. Los datos inválidos devuelven un error sin modificar el estado anterior.

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
12. Recoger monedas, vencer un enemigo, activar la posta y ganar: el panel de logros debe mostrar cada avance. Diez monedas pueden acumularse entre partidas. Ganar con tres vidas desbloquea «Sin un rasguño».
13. Reiniciar y recargar la ventana: comprobar que los logros, récords, estadísticas y premios siguen presentes, con el nivel preparado nuevamente. Cerrar completamente y volver a abrir inicia una sesión nueva.
14. Jugar mientras se procesa un efecto o una exportación. Comparar el HUD con el progreso del editor: los premios deben sumarse sin borrar las monedas recogidas. En pausa no deben avanzar el reloj ni el escudo.
15. Ejecutar el instalador de Windows y abrir desde su pantalla final o el menú Inicio. Confirmar que aparece el editor y el juego en la misma ventana. Importar y exportar sin herramientas de desarrollo en PATH. Desinstalar sin modificar videos originales ni exportaciones.

Los commits de RB1–RB12 fueron realizados por el usuario. Los cambios de RB13–RB14 se dejan sin commit.

## Verificación realizada

- Compilación de TypeScript/Vite y ejecutable Tauri de Windows en modo debug sin instalador.
- Diecinueve pruebas del frontend y diez pruebas de Rust, incluida la generación y decodificación de seis videos con efectos y exportación MP4/WebM/GIF con recorte, resolución, FPS, audio y progreso comprobados.
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
- Estado compartido: contrato JSON, revisiones y secuencias, validación sin mutación en fallos, seis logros sin duplicados, conservación entre partidas y 200 recompensas desde ocho hilos concurrentes junto con actualizaciones del juego.
- WebView2 real: moneda de Phaser → command Rust → evento `game-progress` → panel de logros; exportación real mientras el juego avanza, seis logros, récord, victoria única, reinicio y recarga conservando los datos de la sesión.
- Instalador release NSIS de Windows x64: instalación en carpeta con espacios, acceso de Inicio, manifiesto y huellas de FFmpeg/FFprobe, arranque desde otra carpeta con PATH mínimo, importación/efectos/exportación reales y comprobación del juego/logros, seguido de desinstalación de la copia de prueba.
- Workflow de Windows, Linux y macOS Intel/ARM validado con actionlint. La validación de configuración no sustituye compilar y probar los paquetes de Linux/macOS, aún pendientes.

Captura del HUD y las recompensas en la aplicación: [RB8–RB10](docs/rb8-rb10.png).
Captura del panel de logros en la aplicación: [RB11–RB12](docs/rb11-rb12.png).
Captura del editor y juego de la aplicación instalada: [RB13–RB14](docs/rb13-rb14.png).

Las pruebas de interacción usan selectores simulados en navegador y el evento de arrastre en Tauri. El procesamiento y los eventos de exportación de la prueba son reales. La selección dentro de los diálogos nativos se realiza manualmente.
