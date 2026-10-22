import {
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { root, env } from "./environment.mjs";

// Run after Cargo: all crates compiled for the current platform are now available.
const lock = await readFile(path.join(root, "src-tauri/Cargo.lock"), "utf8");
const registryRoot = path.join(
  env.CARGO_HOME || path.join(homedir(), ".cargo"),
  "registry/src",
);
const registries = (await readdir(registryRoot)).map((name) =>
  path.join(registryRoot, name),
);
const output = path.join(root, "src-tauri/resources/notices/rust");
await mkdir(output, { recursive: true });
const components = [];
for (const block of lock.split("[[package]]").slice(1)) {
  const name = block.match(/^name = "([^"]+)"/m)?.[1];
  const version = block.match(/^version = "([^"]+)"/m)?.[1];
  if (!block.includes('source = "registry+')) continue;
  const directory = registries
    .map((registry) => path.join(registry, `${name}-${version}`))
    .find((candidate) => existsSync(candidate));
  if (!directory) continue; // Crates for other operating systems need not be downloaded.
  const manifest = await readFile(path.join(directory, "Cargo.toml"), "utf8");
  const files = (await readdir(directory, { withFileTypes: true })).filter(
    (file) =>
      /^(licen[sc]es?|copying|notice|copyright)([._-]|$)/i.test(file.name),
  );
  if (files.length) {
    const destination = path.join(output, `${name}-${version}`);
    await mkdir(destination, { recursive: true });
    for (const file of files) {
      if (file.isFile())
        await copyFile(
          path.join(directory, file.name),
          path.join(destination, file.name),
        );
      else if (file.isDirectory())
        await cp(
          path.join(directory, file.name),
          path.join(destination, file.name),
          { recursive: true },
        );
    }
  }
  components.push({
    name,
    version,
    license: manifest.match(/^license\s*=\s*"([^"]+)"/m)?.[1] || null,
    source: `https://crates.io/crates/${name}/${version}`,
    notices: files.map((file) => `${name}-${version}/${file.name}`),
  });
}
if (!components.length)
  throw new Error(
    "No se encontraron los componentes compilados de Rust para incluir sus avisos.",
  );
await writeFile(
  path.join(output, "components.json"),
  JSON.stringify(components, null, 2) + "\n",
);
console.log(
  `Avisos de ${components.length} componentes Rust incluidos antes de empaquetar.`,
);
