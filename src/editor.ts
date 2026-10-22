export type Effect =
  "grayscale" | "sepia" | "blur" | "sharpen" | "pixelate" | "glitch";
export type Trim = { start: number; end: number };
export type VideoMetadata = {
  path: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec: string | null;
  size: number;
  previewPath: string;
};
export type ProcessedPreview = { path: string; start: number; end: number };

export function clampTrim(
  trim: Trim,
  duration: number,
  edge: "start" | "end",
  value: number,
): Trim {
  const gap = Math.min(0.1, duration);
  if (edge === "start")
    return { ...trim, start: Math.max(0, Math.min(value, trim.end - gap)) };
  return {
    ...trim,
    end: Math.min(duration, Math.max(value, trim.start + gap)),
  };
}

export function timecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 100));
  const hours = Math.floor(total / 360000);
  const minutes = Math.floor(total / 6000) % 60;
  const secs = Math.floor(total / 100) % 60;
  const centis = total % 100;
  return `${hours ? `${hours.toString().padStart(2, "0")}:` : ""}${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}

export function fileSize(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
