import { useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save } from "@tauri-apps/plugin-dialog";
import { ArrowUpRight, Check, LoaderCircle } from "lucide-react";
import {
  timecode,
  type Effect,
  type Trim,
  type VideoMetadata,
} from "../editor";

type Format = "mp4" | "webm" | "gif";
type Progress = {
  jobId: string;
  percent: number;
  encodedSeconds: number;
  status: "processing" | "completed" | "failed";
};
type Props = {
  media: VideoMetadata | null;
  trim: Trim;
  effects: Effect[];
  busy: boolean;
};

export default function ExportPanel({ media, trim, effects, busy }: Props) {
  const [format, setFormat] = useState<Format>("mp4");
  const [quality, setQuality] = useState("medium");
  const [resolution, setResolution] = useState("original");
  const [fps, setFps] = useState(30);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [exportDuration, setExportDuration] = useState(0);
  const pending = useRef(false);

  async function exportVideo() {
    if (!media || pending.current || busy) return;
    pending.current = true;
    setError("");
    let unlisten: (() => void) | undefined;
    try {
      const target = await save({
        title: "Exportar video",
        defaultPath: `${media.name.replace(/\.[^.]+$/, "")}-editado.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!target) return;
      const jobId = crypto.randomUUID();
      const duration = trim.end - trim.start;
      setExportDuration(duration);
      setRunning(true);
      setOutput("");
      setProgress({
        jobId,
        percent: 0,
        encodedSeconds: 0,
        status: "processing",
      });
      // Listen before invoking Rust so even a very short export has its first event captured.
      unlisten = await listen<Progress>("export-progress", ({ payload }) => {
        if (payload.jobId === jobId)
          setProgress((previous) => ({
            ...payload,
            percent: Math.max(previous?.percent ?? 0, payload.percent),
          }));
      });
      const path = await invoke<string>("export_video", {
        request: {
          jobId,
          path: media.path,
          output: target,
          start: trim.start,
          end: trim.end,
          effects: [...effects],
          settings: { format, quality, resolution, fps },
        },
      });
      setOutput(path);
      setProgress({
        jobId,
        percent: 100,
        encodedSeconds: duration,
        status: "completed",
      });
    } catch (e) {
      setError(String(e));
      setProgress((previous) =>
        previous ? { ...previous, status: "failed" } : null,
      );
    } finally {
      unlisten?.();
      setRunning(false);
      pending.current = false;
    }
  }

  return (
    <aside className="panel export-panel export-enabled">
      <div className="panel-heading">
        <h2>
          <ArrowUpRight size={16} /> Exportación
        </h2>
        <span className="preview-badge">EN TU EQUIPO</span>
      </div>
      <div className="export-content">
        <div className="export-settings">
          <label>
            Formato
            <select
              aria-label="Formato de exportación"
              value={format}
              disabled={running}
              onChange={(e) => {
                setFormat(e.target.value as Format);
                setOutput("");
              }}
            >
              <option value="mp4">MP4 · H.264</option>
              <option value="webm">WebM · VP9</option>
              <option value="gif">GIF · animado</option>
            </select>
          </label>
          <label>
            Calidad
            <select
              aria-label="Calidad de exportación"
              value={quality}
              disabled={running}
              onChange={(e) => setQuality(e.target.value)}
            >
              <option value="low">Ligera</option>
              <option value="medium">Equilibrada</option>
              <option value="high">Alta</option>
            </select>
          </label>
          <label>
            Resolución
            <select
              aria-label="Resolución de exportación"
              value={resolution}
              disabled={running}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="original">Original</option>
              {["480p", "720p", "1080p", "2160p"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fotogramas
            <select
              aria-label="FPS de exportación"
              value={fps}
              disabled={running}
              onChange={(e) => setFps(Number(e.target.value))}
            >
              {[12, 15, 24, 25, 30, 50, 60].map((value) => (
                <option key={value} value={value}>
                  {value} fps
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="export-hint">
          {format === "gif"
            ? "GIF sin audio. La calidad ajusta la cantidad de colores."
            : "Incluye el audio, el recorte y todos los efectos seleccionados."}{" "}
          La resolución indica la altura y conserva la proporción.
        </p>
        <button
          className="export-button"
          disabled={!media || busy || running || !isTauri()}
          onClick={exportVideo}
        >
          {running ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ArrowUpRight size={16} />
          )}
          {running ? "Exportando… podés jugar abajo" : "Exportar video"}
        </button>
        {(running || progress) && (
          <div className="export-progress" aria-live="polite">
            <div>
              <span>
                {progress?.status === "completed"
                  ? "Exportación completa"
                  : progress?.status === "failed"
                    ? "Exportación interrumpida"
                    : "Procesando tu corte"}
              </span>
              <strong>{Math.floor(progress?.percent ?? 0)}%</strong>
            </div>
            <progress
              aria-label="Progreso de exportación"
              max="100"
              value={progress?.percent ?? 0}
            />
            <small>
              {timecode(progress?.encodedSeconds ?? 0)} /{" "}
              {timecode(exportDuration)}
            </small>
          </div>
        )}
        {output && (
          <div className="export-success" role="status">
            <Check size={15} />
            <span>
              Guardado en{" "}
              <span className="output-path">
                {output.replace(/^\\\\\?\\/, "")}
              </span>
            </span>
          </div>
        )}
        {error && (
          <p className="export-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
