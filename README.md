# RustyBros

Primer avance del editor de video de escritorio: **RB1 a RB4** del proyecto Tauri + Rust. Interfaz en español con React, TypeScript y Vite; procesamiento real de video mediante FFmpeg, invocado exclusivamente desde Rust.

## Funcionalidades

- **RB1:** ventana con biblioteca de archivos, vista previa, controles de reproducción/audio/pantalla completa, línea de tiempo, efectos y panel de exportación.
- **RB2:** selector nativo e importación arrastrando archivos para MP4, MOV, AVI y MKV. Muestra duración, resolución, FPS, códec de video/audio y tamaño. Lee los datos con FFprobe. Los formatos/códecs incompatibles con el visor se convierten a H.264/AAC en caché.
- **RB3:** selección de inicio/fin arrastrando los extremos de la línea de tiempo, usando las flechas sobre cada extremo o editando segundos. Reproducción limitada al tramo seleccionado. El recorte es no destructivo; «Previsualizar recorte» genera el tramo con Rust.
- **RB4:** blanco y negro, sepia, desenfoque, nitidez, pixelado y glitch. Se pueden combinar; se aplican en el orden en que se seleccionaron. «Aplicar efectos» procesa el tramo original en Rust y muestra el MP4 resultante con audio. Nunca se encadenan sobre una copia ya procesada.

La exportación definitiva, el progreso y el juego corresponden a RB5 en adelante. El panel de exportación de RB1 está visible y su botón se habilitará al implementar RB5. No se incluyó Phaser todavía porque el juego queda fuera del alcance RB1–RB4.

## Ejecutar

```powershell
npm install
npm run tauri dev
```

La primera compilación descarga los crates de Rust y puede demorar varios minutos. Se necesita Node.js 22, Rust estable y las herramientas de compilación de Tauri para el sistema operativo. En Windows también se requiere WebView2. Esta carpeta puede usar una instalación portátil en `.tools/` de Rust GNU + LLVM-MinGW: el lanzador la detecta automáticamente y configura el entorno solamente para su proceso. Si `.tools/` no está presente, usa Rust y el compilador del sistema. Para Windows con Rust MSVC se necesitan Visual Studio Build Tools con «Desarrollo para el escritorio con C++» y Windows SDK.

`npm install` descarga FFmpeg y FFprobe como dependencias de desarrollo locales. Se puede usar una instalación propia mediante `RUSTYBROS_FFMPEG` y `RUSTYBROS_FFPROBE` (rutas a los ejecutables); sin binarios locales se buscan en `PATH`. No se genera instalador en esta etapa. Para distribuir posteriormente se deberá empaquetar FFmpeg y revisar sus licencias (incluida la variante GPL de ffmpeg-static).

```powershell
npm run dev      # vista web: solo interfaz; Rust requiere la app de escritorio
npm run build    # comprobación de TypeScript y compilación del frontend
npm test         # límites del recorte y formato del tiempo
npm run test:rust # procesamiento de los seis efectos, recorte, resolución y audio
```

El visor usa espacio para reproducir/pausar cuando el foco no está en un control. Las flechas sobre los extremos ajustan el recorte de a 0,1 s. «Restablecer edición» vuelve al clip completo sin efectos. Importar otro video agrega un archivo a la biblioteca; cambiar de clip reinicia su edición.

## Arquitectura

```text
src/App.tsx                Interfaz, reproducción y selección no destructiva
src/editor.ts              Tipos, límites de recorte y formato de metadatos
src/styles.css             Diseño adaptable
src-tauri/src/video.rs     Commands import_video / apply_effects, FFprobe y FFmpeg
src-tauri/src/processing.rs Ejecución de FFmpeg, filtros y pruebas de video reales
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

No se inicializó ni se crearon commits en Git.

## Verificación realizada

- Compilación de TypeScript/Vite y ejecutable Tauri de Windows en modo debug sin instalador.
- Tres pruebas del frontend y dos pruebas de Rust, incluida la generación y decodificación de seis videos con efectos, duración recortada, dimensiones y audio comprobados.
- Revisión de interfaz en escritorio y móvil, sin errores de consola ni desbordes horizontales.
- Pruebas de arrastre de extremos, teclado, campos de rango, selección combinada de efectos y restablecimiento.
- Prueba de extremo a extremo en el WebView2 real de Tauri: importación de MP4, MOV, AVI y MKV, reproducción, los seis efectos por separado, una combinación y reproducción del recorte de dos segundos.
- Rechazo de archivo corrupto y de intentos de procesar un archivo que no fue importado.

Las pruebas de interacción usan un selector simulado en navegador y el evento de arrastre en Tauri. La apertura del diálogo nativo se verificó, pero la selección dentro del diálogo requiere interacción del usuario.
