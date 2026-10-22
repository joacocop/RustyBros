import { useEffect, useRef, useState, type PointerEvent } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clapperboard,
  Film,
  FolderOpen,
  Gamepad2,
  Layers3,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  SkipBack,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from "lucide-react";
import {
  clampTrim,
  fileSize,
  timecode,
  type Effect,
  type ProcessedPreview,
  type Trim,
  type VideoMetadata,
} from "./editor";

const effectOptions: {
  id: Effect;
  label: string;
  description: string;
  className: string;
}[] = [
  {
    id: "grayscale",
    label: "Blanco y negro",
    description: "Lo esencial, sin color",
    className: "mono",
  },
  {
    id: "sepia",
    label: "Sepia",
    description: "Un poco de nostalgia",
    className: "sepia",
  },
  {
    id: "blur",
    label: "Desenfoque",
    description: "Suave y atmosférico",
    className: "blur",
  },
  {
    id: "sharpen",
    label: "Nitidez",
    description: "Cada detalle cuenta",
    className: "sharp",
  },
  {
    id: "pixelate",
    label: "Pixelado",
    description: "Espíritu de 8 bits",
    className: "pixel",
  },
  {
    id: "glitch",
    label: "Glitch",
    description: "Rompé la señal",
    className: "glitch",
  },
];

export default function App() {
  const [library, setLibrary] = useState<VideoMetadata[]>([]);
  const [media, setMedia] = useState<VideoMetadata | null>(null);
  const [trim, setTrim] = useState<Trim>({ start: 0, end: 0 });
  const [effects, setEffects] = useState<Effect[]>([]);
  const [preview, setPreview] = useState<ProcessedPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Tu próxima historia empieza acá.");
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragEdge = useRef<"start" | "end" | null>(null);
  const native = isTauri();
  const duration = media?.duration ?? 0;
  const previewOffset = preview?.start ?? 0;
  const source = media
    ? convertFileSrc(preview?.path ?? media.previewPath)
    : undefined;
  const importPathRef = useRef(importPath);
  importPathRef.current = importPath;

  useEffect(() => {
    if (!native) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        setDragging(
          event.payload.type === "over" || event.payload.type === "enter",
        );
        if (event.payload.type === "drop" && event.payload.paths[0]) {
          void importPathRef.current(event.payload.paths[0]);
        }
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else cleanup = unlisten;
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [native]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.code === "Space" &&
        !["INPUT", "BUTTON", "SELECT", "TEXTAREA"].includes(target.tagName)
      ) {
        event.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function pause() {
    videoRef.current?.pause();
    setPlaying(false);
  }
  function seek(time: number) {
    if (!media || !videoRef.current) return;
    const next = Math.max(trim.start, Math.min(time, trim.end));
    videoRef.current.currentTime = Math.max(0, next - previewOffset);
    setCurrent(next);
  }
  function togglePlayback() {
    if (!videoRef.current || !media || busy) return;
    if (playing) {
      pause();
      return;
    }
    if (current >= trim.end - 0.03 || current < trim.start) seek(trim.start);
    videoRef.current
      .play()
      .catch(() =>
        setError(
          "No se pudo reproducir el video. Volvé a importarlo para generar una vista compatible.",
        ),
      );
  }
  function selectMedia(next: VideoMetadata) {
    pause();
    setMedia(next);
    setTrim({ start: 0, end: next.duration });
    setCurrent(0);
    setEffects([]);
    setPreview(null);
    setError("");
    setNotice("Video listo. Elegí el tramo que querés conservar.");
  }
  async function importVideo() {
    if (!native) {
      setError(
        "Abrí la aplicación de escritorio con npm run tauri dev para importar y procesar videos con Rust.",
      );
      return;
    }
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Video", extensions: ["mp4", "mov", "avi", "mkv"] }],
      });
      if (!path || typeof path !== "string") return;
      await importPath(path);
    } catch (e) {
      setError(String(e));
    }
  }
  async function importPath(path: string) {
    if (busy) return;
    try {
      pause();
      setBusy("Importando video y preparando el visor…");
      setError("");
      const result = await invoke<VideoMetadata>("import_video", { path });
      setLibrary((previous) => [
        ...previous.filter((item) => item.path !== result.path),
        result,
      ]);
      selectMedia(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }
  function updateTrim(edge: "start" | "end", value: number) {
    if (!media || busy || !Number.isFinite(value)) return;
    pause();
    setPreview(null);
    const next = clampTrim(trim, media.duration, edge, value);
    const nextTime =
      edge === "start"
        ? next.start
        : Math.min(Math.max(current, next.start), next.end);
    setTrim(next);
    setCurrent(nextTime);
    if (!preview && videoRef.current) videoRef.current.currentTime = nextTime;
    setNotice(
      "Recorte actualizado. Aplicá los efectos para previsualizar este tramo.",
    );
  }
  function position(event: PointerEvent): number {
    const rect = trackRef.current!.getBoundingClientRect();
    return (
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) *
      duration
    );
  }
  function startDrag(
    edge: "start" | "end",
    event: PointerEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragEdge.current = edge;
  }
  function drag(event: PointerEvent<HTMLButtonElement>) {
    if (dragEdge.current) updateTrim(dragEdge.current, position(event));
  }
  function reset() {
    if (!media) return;
    pause();
    setTrim({ start: 0, end: duration });
    setEffects([]);
    setPreview(null);
    setCurrent(0);
    setNotice("Volviste al video original.");
    setError("");
  }
  async function applyEffects() {
    if (!media) return;
    pause();
    setBusy("Rust está procesando tu selección…");
    setError("");
    try {
      const result = await invoke<ProcessedPreview>("apply_effects", {
        path: media.path,
        start: trim.start,
        end: trim.end,
        effects,
      });
      setPreview(result);
      setCurrent(trim.start);
      setNotice(
        `Vista previa lista · ${effects.length ? `${effects.length} efecto${effects.length > 1 ? "s" : ""}` : "recorte sin efectos"} · original intacto`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }
  function toggleEffect(effect: Effect) {
    pause();
    setPreview(null);
    setEffects((previous) =>
      previous.includes(effect)
        ? previous.filter((e) => e !== effect)
        : [...previous, effect],
    );
    setNotice("Efectos pendientes. Aplicá la selección para ver el resultado.");
  }
  function loaded() {
    const video = videoRef.current;
    if (video)
      video.currentTime = Math.max(
        0,
        Math.max(trim.start, Math.min(current, trim.end)) - previewOffset,
      );
  }
  function timeUpdate() {
    const video = videoRef.current;
    if (!video) return;
    const time = video.currentTime + previewOffset;
    if (time >= trim.end) {
      video.pause();
      setCurrent(trim.end);
    } else if (time < trim.start - 0.02) {
      video.currentTime = trim.start - previewOffset;
      setCurrent(trim.start);
    } else setCurrent(time);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="RustyBros inicio">
          <span className="brand-icon">
            <Clapperboard size={22} />
          </span>
          Rusty<span>Bros</span>
          <small>STUDIO</small>
        </a>
        <div className="workspace-name">
          <span className="status-dot" /> Mi espacio de edición{" "}
          <ChevronRight size={14} />
          <span>Sin título</span>
        </div>
        <span className="build-tag">
          PRIMER CORTE <span>01—04</span>
        </span>
      </header>

      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">UN POCO DE RUST. MUCHA CREATIVIDAD.</div>
            <h1>Dale tu propio ritmo.</h1>
            <p>Importá, recortá y transformá. La historia la contás vos.</p>
          </div>
          <button className="primary" onClick={importVideo} disabled={!!busy}>
            <Plus size={17} /> Importar video
          </button>
        </div>

        {!native && (
          <div className="browser-note">
            <Film size={15} /> Vista web del editor. La importación y los
            efectos funcionan en la aplicación de escritorio.
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              onClick={() => setError("")}
              aria-label="Cerrar error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="editor-grid">
          <aside className="panel library">
            <div className="panel-heading">
              <h2>
                <FolderOpen size={16} /> Tus archivos
              </h2>
              <span className="count">
                {library.length.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="library-content">
              {library.length === 0 ? (
                <button
                  className="import-zone"
                  onClick={importVideo}
                  disabled={!!busy}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    setError(
                      "Usá «Importar video» para seleccionar un archivo local.",
                    );
                  }}
                  data-dragging={dragging}
                >
                  <span className="upload-icon">
                    <ArrowDownToLine size={23} />
                  </span>
                  <strong>Un buen comienzo</strong>
                  <span>
                    Elegí tu primer video
                    <br />y hacelo tuyo.
                  </span>
                  <span className="text-link">
                    Explorar archivos <ArrowUpRight size={13} />
                  </span>
                </button>
              ) : (
                <div className="media-list">
                  {library.map((item) => (
                    <button
                      key={item.path}
                      className={`media-card ${media?.path === item.path ? "active" : ""}`}
                      onClick={() => selectMedia(item)}
                      disabled={!!busy}
                    >
                      <span className="media-thumb">
                        <Film size={26} />
                        <span>{timecode(item.duration)}</span>
                      </span>
                      <strong title={item.name}>{item.name}</strong>
                      <small>
                        {item.width} × {item.height}{" "}
                        <span>· {item.codec.toUpperCase()}</span>
                      </small>
                    </button>
                  ))}
                </div>
              )}
              <div className="format-note">MP4 · MOV · AVI · MKV</div>
              {media ? (
                <div className="metadata">
                  <div className="section-label">INFORMACIÓN DEL CLIP</div>
                  <dl>
                    <dt>Duración</dt>
                    <dd>{timecode(duration)}</dd>
                    <dt>Resolución</dt>
                    <dd>
                      {media.width} × {media.height}
                    </dd>
                    <dt>Fotogramas</dt>
                    <dd>{media.fps.toFixed(2)} fps</dd>
                    <dt>Video</dt>
                    <dd>{media.codec.toUpperCase()}</dd>
                    <dt>Audio</dt>
                    <dd>{media.audioCodec?.toUpperCase() ?? "Sin audio"}</dd>
                    <dt>Tamaño</dt>
                    <dd>{fileSize(media.size)}</dd>
                  </dl>
                </div>
              ) : (
                <div className="library-tip">
                  <Layers3 size={18} />
                  <p>
                    Tu original siempre intacto.
                    <br />
                    <span>Explorá sin miedo a equivocarte.</span>
                  </p>
                </div>
              )}
            </div>
            <div className="game-teaser">
              <Gamepad2 size={21} />
              <div>
                <strong>Editá. Jugá. Repetí.</strong>
                <span>El modo juego llega pronto.</span>
              </div>
              <span className="soon">PRONTO</span>
            </div>
          </aside>

          <section className="panel preview-panel">
            <div className="panel-heading">
              <h2>
                <Film size={16} /> Vista previa
              </h2>
              <span className={`preview-badge ${preview ? "processed" : ""}`}>
                {preview
                  ? "EFECTOS APLICADOS"
                  : media
                    ? "ORIGINAL"
                    : "SIN VIDEO"}
              </span>
            </div>
            <div className="preview-stage">
              {media ? (
                <video
                  ref={videoRef}
                  src={source}
                  muted={muted}
                  onLoadedMetadata={loaded}
                  onTimeUpdate={timeUpdate}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => {
                    setPlaying(false);
                    setCurrent(trim.end);
                  }}
                  onError={() =>
                    setError(
                      "El visor no pudo abrir el video. Volvé a importarlo o verificá que FFmpeg esté disponible.",
                    )
                  }
                  playsInline
                />
              ) : (
                <div className="preview-empty">
                  <div className="frame-art">
                    <div className="art-sun" />
                    <div className="art-mountain back" />
                    <div className="art-mountain front" />
                    <span className="art-play">
                      <Play size={22} fill="currentColor" />
                    </span>
                    <span className="art-corner top-left" />
                    <span className="art-corner bottom-right" />
                  </div>
                  <h3>Un lienzo para tus ideas.</h3>
                  <p>
                    Tu video aparece acá.
                    <br />
                    El resto es pura imaginación.
                  </p>
                </div>
              )}
              {media && (
                <span className="stage-resolution">
                  {media.width} × {media.height}
                </span>
              )}
              {busy && (
                <div className="processing" role="status">
                  <LoaderCircle className="spin" size={30} />
                  <strong>{busy}</strong>
                  <span>Podés seguir el resultado acá cuando esté listo.</span>
                </div>
              )}
            </div>
            <div className="transport">
              <span className="playback-time">
                {timecode(current)} <span>/ {timecode(duration)}</span>
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Ir al inicio del recorte"
                  disabled={!media || !!busy}
                  onClick={() => seek(trim.start)}
                >
                  <SkipBack size={17} />
                </button>
                <button
                  className="play-button"
                  aria-label={playing ? "Pausar" : "Reproducir"}
                  disabled={!media || !!busy}
                  onClick={togglePlayback}
                >
                  {playing ? (
                    <Pause size={17} fill="currentColor" />
                  ) : (
                    <Play size={17} fill="currentColor" />
                  )}
                </button>
              </div>
              <div>
                <button
                  className="icon-button"
                  onClick={() => setMuted(!muted)}
                  aria-label={muted ? "Activar audio" : "Silenciar"}
                  disabled={!media}
                >
                  {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <button
                  className="icon-button"
                  aria-label="Pantalla completa"
                  disabled={!media}
                  onClick={() =>
                    videoRef.current
                      ?.requestFullscreen()
                      .catch(() =>
                        setError("No se pudo abrir la pantalla completa."),
                      )
                  }
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
          </section>

          <aside className="panel effects-panel">
            <div className="panel-heading">
              <h2>
                <WandSparkles size={16} /> Efectos
              </h2>
              <span className="count">06</span>
            </div>
            <div className="effects-content">
              <p className="panel-description">Un clip. Otra personalidad.</p>
              <div className="effects-list">
                {effectOptions.map((effect) => (
                  <button
                    key={effect.id}
                    disabled={!media || !!busy}
                    className={`effect-card ${effects.includes(effect.id) ? "selected" : ""}`}
                    aria-pressed={effects.includes(effect.id)}
                    onClick={() => toggleEffect(effect.id)}
                  >
                    <span className={`effect-art ${effect.className}`}>
                      <i />
                      <b />
                    </span>
                    <span>
                      <strong>{effect.label}</strong>
                      <small>{effect.description}</small>
                    </span>
                    <span className="effect-check">
                      {effects.includes(effect.id) ? (
                        <Check size={12} />
                      ) : (
                        <Plus size={12} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <button
                className="apply-button"
                disabled={!media || !!busy}
                onClick={applyEffects}
              >
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Sparkles size={16} />
                )}{" "}
                {effects.length
                  ? `Aplicar ${effects.length} efecto${effects.length > 1 ? "s" : ""}`
                  : "Previsualizar recorte"}
              </button>
              <p className="processing-note">
                Procesamiento local con Rust + FFmpeg
              </p>
            </div>
          </aside>

          <section className="panel timeline-panel">
            <div className="panel-heading">
              <h2>
                <Scissors size={16} /> Línea de tiempo
              </h2>
              <div className="timeline-heading-right">
                <span>Arrastrá los extremos para recortar</span>
                <button
                  className="icon-button"
                  aria-label="Restablecer edición"
                  title="Restablecer edición"
                  disabled={!media || !!busy}
                  onClick={reset}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
            <div className="timeline-body">
              <div className="track-label">
                <Film size={15} />
                <span>VIDEO 01</span>
              </div>
              <div className="timeline-main">
                <div className="ruler">
                  {Array.from({ length: 7 }, (_, index) => (
                    <span key={index}>{timecode((duration * index) / 6)}</span>
                  ))}
                </div>
                <div
                  ref={trackRef}
                  className={`video-track ${media ? "has-media" : ""}`}
                  onPointerDown={(event) => {
                    if (media && !busy) seek(position(event));
                  }}
                >
                  {media ? (
                    <>
                      <div className="clip-film">
                        {Array.from({ length: 12 }, (_, i) => (
                          <span key={i}>
                            <Film size={17} />
                          </span>
                        ))}
                      </div>
                      <div
                        className="trim-shade left"
                        style={{ width: `${(trim.start / duration) * 100}%` }}
                      />
                      <div
                        className="trim-shade right"
                        style={{ width: `${(1 - trim.end / duration) * 100}%` }}
                      />
                      <div
                        className="trim-selection"
                        style={{
                          left: `${(trim.start / duration) * 100}%`,
                          width: `${((trim.end - trim.start) / duration) * 100}%`,
                        }}
                      >
                        <span className="clip-name">{media.name}</span>
                        {(["start", "end"] as const).map((edge) => (
                          <button
                            key={edge}
                            className={`trim-handle ${edge}`}
                            aria-label={
                              edge === "start"
                                ? "Inicio del recorte"
                                : "Fin del recorte"
                            }
                            role="slider"
                            aria-valuemin={
                              edge === "start"
                                ? 0
                                : trim.start + Math.min(0.1, duration)
                            }
                            aria-valuemax={
                              edge === "start"
                                ? trim.end - Math.min(0.1, duration)
                                : duration
                            }
                            aria-valuenow={trim[edge]}
                            aria-valuetext={timecode(trim[edge])}
                            disabled={!!busy}
                            onPointerDown={(event) => startDrag(edge, event)}
                            onPointerMove={drag}
                            onPointerUp={() => {
                              dragEdge.current = null;
                            }}
                            onPointerCancel={() => {
                              dragEdge.current = null;
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key === "ArrowRight" ||
                                event.key === "ArrowLeft"
                              ) {
                                event.preventDefault();
                                updateTrim(
                                  edge,
                                  trim[edge] +
                                    (event.key === "ArrowRight" ? 0.1 : -0.1),
                                );
                              }
                            }}
                          >
                            <i />
                            <i />
                          </button>
                        ))}
                      </div>
                      <div
                        className="playhead"
                        style={{ left: `${(current / duration) * 100}%` }}
                      >
                        <i />
                      </div>
                    </>
                  ) : (
                    <span className="empty-track">
                      <Plus size={15} /> Importá un video para empezar tu primer
                      corte
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="trim-controls">
              <span className="selection-label">
                <span className="status-dot" /> SELECCIÓN
              </span>
              <label>
                Inicio{" "}
                <input
                  aria-label="Inicio en segundos"
                  type="number"
                  min="0"
                  max={trim.end}
                  step="0.1"
                  value={Number(trim.start.toFixed(3))}
                  disabled={!media || !!busy}
                  onChange={(event) =>
                    updateTrim("start", event.currentTarget.valueAsNumber)
                  }
                />
                <span>s</span>
              </label>
              <span className="range-divider">→</span>
              <label>
                Fin{" "}
                <input
                  aria-label="Fin en segundos"
                  type="number"
                  min={trim.start}
                  max={duration}
                  step="0.1"
                  value={Number(trim.end.toFixed(3))}
                  disabled={!media || !!busy}
                  onChange={(event) =>
                    updateTrim("end", event.currentTarget.valueAsNumber)
                  }
                />
                <span>s</span>
              </label>
              <span className="selection-duration">
                Duración del corte{" "}
                <strong>{timecode(trim.end - trim.start)}</strong>
              </span>
            </div>
          </section>

          <aside className="panel export-panel">
            <div className="panel-heading">
              <h2>
                <ArrowUpRight size={16} /> Exportación
              </h2>
              <span className="soon">RB5</span>
            </div>
            <div className="export-content">
              <div className="export-summary">
                <span className="export-format">MP4</span>
                <div>
                  <strong>Tu historia, lista para salir.</strong>
                  <p>
                    Formato, calidad y resolución
                    <br />
                    en la próxima etapa.
                  </p>
                </div>
              </div>
              <button disabled className="export-button">
                <ArrowUpRight size={16} /> Exportar video <span>PRONTO</span>
              </button>
            </div>
          </aside>
        </div>
        <footer>
          <span className="footer-notice" role="status">
            <span className="status-dot" />
            {notice}
          </span>
          <span className="footer-local">
            <SlidersHorizontal size={13} /> Hecho en tu equipo. A tu ritmo.
          </span>
        </footer>
      </main>
    </div>
  );
}
