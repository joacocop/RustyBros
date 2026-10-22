import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { root } from "./environment.mjs";
import { cleanRuntimeEnvironment } from "./runtime-environment.mjs";

if (process.platform !== "win32")
  throw new Error("Esta prueba instala el paquete NSIS en Windows.");
function powershell(command) {
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { encoding: "utf8", windowsHide: true },
  ).trim();
}
const installedBefore = powershell(
  "@(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'RustyBros' }).Count",
);
assert.equal(
  installedBefore,
  "0",
  "Ya existe una instalación de RustyBros. La prueba no reemplaza instalaciones existentes.",
);
const bundles = path.join(root, "src-tauri/target/release/bundle/nsis");
const installers = (await readdir(bundles)).filter((file) =>
  file.endsWith("-setup.exe"),
);
assert.equal(
  installers.length,
  1,
  "Se necesita un único instalador NSIS de release. Ejecutá npm run tauri -- build.",
);
const installer = path.join(bundles, installers[0]);
const testRoot = path.join(root, "tmp", `installer-smoke-${randomUUID()}`);
const installRoot = path.join(testRoot, "RustyBros instalado");
assert(!path.relative(root, installRoot).startsWith(".."));
await mkdir(testRoot, { recursive: true });
function run(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: testRoot,
      windowsHide: true,
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${path.basename(executable)} terminó con código ${code}.`,
            ),
          ),
    );
  });
}
const uninstaller = path.join(installRoot, "uninstall.exe");
try {
  // NSIS requires an unquoted /D= path as the final command-line argument.
  await run(installer, ["/S", `/D=${installRoot}`], {
    windowsVerbatimArguments: true,
  });
  const executable = path.join(installRoot, "rustybros.exe");
  assert(
    existsSync(executable),
    "El instalador debe incluir el ejecutable principal.",
  );
  assert(
    existsSync(uninstaller),
    "Debe poder desinstalarse la copia de prueba.",
  );
  const manifest = JSON.parse(
    await readFile(path.join(installRoot, "runtime/manifest.json"), "utf8"),
  );
  assert.equal(manifest.platform, "win32");
  assert.equal(manifest.arch, "x64");
  for (const [name, tool] of Object.entries(manifest.tools)) {
    const file = path.join(installRoot, "runtime", tool.file);
    assert.equal(
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex"),
      tool.sha256,
    );
    const version = execFileSync(file, ["-version"], {
      encoding: "utf8",
      env: cleanRuntimeEnvironment(),
      cwd: testRoot,
      windowsHide: true,
    });
    assert(
      version.startsWith(tool.version),
      `${name} debe ejecutarse sin herramientas del sistema.`,
    );
  }
  assert(existsSync(path.join(installRoot, "notices/FFmpeg-LICENSE.txt")));
  assert(
    existsSync(path.join(installRoot, "notices/@tauri-apps-api-LICENSE-MIT")),
  );
  const rustComponents = JSON.parse(
    await readFile(
      path.join(installRoot, "notices/rust/components.json"),
      "utf8",
    ),
  );
  assert(rustComponents.some((component) => component.name === "tauri"));
  const shortcut = path.join(
    process.env.APPDATA,
    "Microsoft/Windows/Start Menu/Programs/RustyBros/RustyBros.lnk",
  );
  assert(existsSync(shortcut), "Debe existir el acceso del menú Inicio.");
  const shortcutData = JSON.parse(
    powershell(
      "$shell = New-Object -ComObject WScript.Shell; $link = $shell.CreateShortcut((Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/RustyBros/RustyBros.lnk')); @{ target = $link.TargetPath; arguments = $link.Arguments } | ConvertTo-Json -Compress",
    ),
  );
  assert.equal(
    path.resolve(shortcutData.target).toLowerCase(),
    executable.toLowerCase(),
  );
  assert.equal(shortcutData.arguments, "");
  console.log(
    "Instalación NSIS: archivos, huellas, licencias y acceso al editor OK.",
  );
  await run(process.execPath, [
    path.join(root, "scripts/test-native-game.mjs"),
    "--executable",
    executable,
    "--clean-env",
    "--screenshot",
    path.join(root, "docs/rb13-rb14.png"),
  ]);
} finally {
  if (existsSync(uninstaller))
    await run(uninstaller, ["/S", `_?=${installRoot}`], {
      windowsVerbatimArguments: true,
    });
}
assert(
  !existsSync(path.join(installRoot, "rustybros.exe")),
  "La copia instalada debe eliminarse al desinstalar.",
);
const installedAfter = powershell(
  "@(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'RustyBros' }).Count",
);
assert.equal(
  installedAfter,
  "0",
  "La entrada de desinstalación de la copia de prueba debe eliminarse.",
);
console.log(
  "Desinstalación de la copia de prueba OK. El instalador de entrega se conserva.",
);
