// A packaged app must work without the repository, Node, Rust or FFmpeg in PATH.
export function cleanRuntimeEnvironment(source = process.env) {
  const result = { ...source };
  for (const key of Object.keys(result)) {
    if (
      ["path", "ffmpeg_bin"].includes(key.toLowerCase()) ||
      /^rustybros_(ffmpeg|ffprobe)$/i.test(key)
    )
      delete result[key];
  }
  const systemRoot = source.SystemRoot || source.SYSTEMROOT || "C:\\Windows";
  result.PATH = `${systemRoot}\\System32;${systemRoot}`;
  return result;
}
