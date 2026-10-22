import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { root } from "./environment.mjs";

const bundle = path.join(root, "src-tauri/target/release/bundle");
const output = path.join(root, "artifacts");
const packages = [];
async function walk(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory() && !item.name.endsWith(".app")) await walk(file);
    else if (
      item.isFile() &&
      /(?:-setup\.exe|\.msi|\.dmg|\.deb|\.AppImage)$/.test(item.name)
    )
      packages.push(file);
  }
}
await walk(bundle);
if (!packages.length)
  throw new Error(
    "No hay instaladores de release. Ejecutá npm run tauri -- build.",
  );
await mkdir(output, { recursive: true });
const checksums = [];
for (const source of packages.sort()) {
  const destination = path.join(output, path.basename(source));
  await copyFile(source, destination);
  const hash = createHash("sha256")
    .update(await readFile(destination))
    .digest("hex");
  checksums.push(`${hash}  ${path.basename(destination)}`);
}
await writeFile(
  path.join(output, "SHA256SUMS.txt"),
  checksums.join("\n") + "\n",
);
await copyFile(
  path.join(root, "docs/DISTRIBUTION.md"),
  path.join(output, "INSTALACION.md"),
);
await cp(
  path.join(root, "src-tauri/resources/notices"),
  path.join(output, "notices"),
  { recursive: true },
);
const manifest = JSON.parse(
  await readFile(
    path.join(root, "src-tauri/resources/runtime/manifest.json"),
    "utf8",
  ),
);
await writeFile(
  path.join(output, "build-info.json"),
  JSON.stringify(
    {
      version: JSON.parse(
        await readFile(path.join(root, "package.json"), "utf8"),
      ).version,
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      }).trim(),
      workingTreeDirty: !!execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
      }).trim(),
      signed: false,
      runtime: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Instaladores copiados a artifacts/: ${packages.map((file) => path.basename(file)).join(", ")}. SHA-256 y avisos incluidos.`,
);
