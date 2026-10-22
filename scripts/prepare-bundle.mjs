import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
  chmod,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { root, env } from "./environment.mjs";

const require = createRequire(import.meta.url);
const supported = ["win32-x64", "linux-x64", "darwin-x64", "darwin-arm64"];
if (!supported.includes(`${process.platform}-${process.arch}`))
  throw new Error(
    `Empaquetado no configurado para ${process.platform}-${process.arch}.`,
  );
const rust = execFileSync("rustc", ["-vV"], {
  env,
  encoding: "utf8",
  windowsHide: true,
});
const host = rust.match(/^host: (.+)$/m)?.[1].trim();
const target =
  process.env.TAURI_ENV_TARGET_TRIPLE || process.env.CARGO_BUILD_TARGET || host;
const targetArch = target?.split("-")[0];
const expectedArch = process.arch === "arm64" ? "aarch64" : "x86_64";
const expectedOS =
  process.platform === "darwin"
    ? "apple-darwin"
    : process.platform === "win32"
      ? "windows"
      : "linux";
if (targetArch !== expectedArch || !target.includes(expectedOS))
  throw new Error(
    "Prepará cada instalador en su sistema y arquitectura nativos; los binarios multimedia deben coincidir con el destino.",
  );
const runtime = path.join(root, "src-tauri/resources/runtime");
const notices = path.join(root, "src-tauri/resources/notices");
await Promise.all(
  [runtime, notices].map((directory) => mkdir(directory, { recursive: true })),
);
const extension = process.platform === "win32" ? ".exe" : "";
const sources = {
  ffmpeg: process.env.RUSTYBROS_FFMPEG || require("ffmpeg-static"),
  ffprobe: process.env.RUSTYBROS_FFPROBE || require("ffprobe-static").path,
};
const manifest = {
  platform: process.platform,
  arch: process.arch,
  target,
  tools: {},
};
for (const [name, source] of Object.entries(sources)) {
  if (!source || !existsSync(source))
    throw new Error(`Falta ${name}. Ejecutá npm ci antes de compilar.`);
  const version = execFileSync(source, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const destination = path.join(runtime, name + extension);
  await copyFile(source, destination);
  if (process.platform !== "win32") await chmod(destination, 0o755);
  const sha256 = createHash("sha256")
    .update(await readFile(destination))
    .digest("hex");
  manifest.tools[name] = {
    file: name + extension,
    version: version.split(/\r?\n/)[0],
    sha256,
  };
  await writeFile(path.join(notices, `${name}-version.txt`), version);
}
const encoders = execFileSync(sources.ffmpeg, ["-hide_banner", "-encoders"], {
  encoding: "utf8",
  windowsHide: true,
});
for (const codec of ["libx264", "libvpx-vp9", "libopus", "gif"])
  if (!encoders.includes(codec))
    throw new Error(`El FFmpeg del paquete no incluye ${codec}.`);
const ffmpegLicense = `${sources.ffmpeg}.LICENSE`,
  ffmpegReadme = `${sources.ffmpeg}.README`;
if (!existsSync(ffmpegLicense) || !existsSync(ffmpegReadme))
  throw new Error(
    "Faltan la licencia y procedencia de FFmpeg (.LICENSE y .README junto al ejecutable). Reinstalá ffmpeg-static o proporcioná esos archivos con el binario propio.",
  );
await copyFile(ffmpegLicense, path.join(notices, "FFmpeg-LICENSE.txt"));
await copyFile(ffmpegReadme, path.join(notices, "FFmpeg-build-README.txt"));
await copyFile(
  require.resolve("ffprobe-static/LICENSE"),
  path.join(notices, "ffprobe-static-wrapper-LICENSE.txt"),
);
await copyFile(
  require.resolve("ffprobe-static/README.md"),
  path.join(notices, "ffprobe-static-README.txt"),
);
const packages = [
  "react",
  "react-dom",
  "scheduler",
  "phaser",
  "eventemitter3",
  "lucide-react",
  "@tauri-apps/api",
  "@tauri-apps/plugin-dialog",
];
for (const name of packages) {
  const directory = path.join(root, "node_modules", name);
  for (const file of await readdir(directory)) {
    if (/^(licen[sc]e|copying|notice)([._-]|$)/i.test(file))
      await copyFile(
        path.join(directory, file),
        path.join(notices, `${name.replaceAll("/", "-")}-${file}`),
      );
  }
}
await writeFile(
  path.join(runtime, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await copyFile(
  path.join(root, "docs/THIRD_PARTY_NOTICES.md"),
  path.join(notices, "THIRD_PARTY_NOTICES.md"),
);
console.log(
  `Recursos listos para ${target}: FFmpeg, FFprobe, licencias y manifiesto SHA-256.`,
);
