import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import path from "node:path";
import { parseArgs } from "node:util";
import { root, env } from "./environment.mjs";
import { cleanRuntimeEnvironment } from "./runtime-environment.mjs";

const { values } = parseArgs({
  options: {
    executable: { type: "string" },
    "clean-env": { type: "boolean" },
    screenshot: { type: "string" },
  },
});

if (process.platform !== "win32")
  throw new Error("Esta prueba usa el WebView2 de Windows.");
const executable = values.executable
  ? path.resolve(values.executable)
  : path.join(root, "src-tauri/target/debug/rustybros.exe");
if (!existsSync(executable))
  throw new Error(
    "Primero compilá con npm run tauri -- build --debug --no-bundle.",
  );
const temporary = path.join(root, "tmp/native-game");
await mkdir(temporary, { recursive: true });
const fixture = path.join(temporary, "fixture.mp4");
await new Promise((resolve, reject) => {
  const child = spawn(
    ffmpeg,
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=24",
      "-t",
      "3",
      "-pix_fmt",
      "yuv420p",
      fixture,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0
      ? resolve()
      : reject(new Error("No se pudo crear el video de prueba.")),
  );
});
const port = 9223;
try {
  await fetch(`http://127.0.0.1:${port}/json/version`);
  throw new Error(`El puerto ${port} ya está ocupado.`);
} catch (error) {
  if (!String(error).includes("fetch failed")) throw error;
}
const app = spawn(executable, [], {
  cwd: values["clean-env"] ? temporary : root,
  env: {
    ...(values["clean-env"] ? cleanRuntimeEnvironment() : env),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
  },
  windowsHide: true,
  stdio: "ignore",
});
let browser;
try {
  let connected = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        connected = true;
        break;
      }
    } catch {
      /* WebView is starting. */
    }
    if (app.exitCode !== null)
      throw new Error("La aplicación se cerró antes de iniciar WebView2.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(connected, "WebView2 no inició el puerto de prueba.");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = browser.contexts()[0].pages()[0];
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // CDP can attach while WebView2 is still navigating away from about:blank.
  // Wait for the first real app load before injecting the next-load game capture.
  await page.getByRole("button", { name: "Empezar aventura" }).waitFor();
  // Capture the real game instance without adding test hooks to production code.
  await page.addInitScript(() => {
    Object.defineProperty(window, "Phaser", {
      configurable: true,
      set(value) {
        const Game = value.Game;
        value.Game = class extends Game {
          constructor(config) {
            super(config);
            window.__testGame = this;
          }
        };
        Object.defineProperty(window, "Phaser", {
          value,
          writable: true,
          configurable: true,
        });
      },
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Empezar aventura" }).waitFor();
  await page.getByRole("heading", { name: "Dale tu propio ritmo." }).waitFor();
  if (values["clean-env"]) {
    assert.match(
      page.url(),
      /^(tauri:\/\/localhost|https?:\/\/tauri\.localhost)/,
    );
    if (values.screenshot)
      await page.screenshot({
        path: path.resolve(values.screenshot),
        fullPage: true,
      });
    console.log(
      "Inicio instalado: editor, juego embebido y recursos locales sin servidor ni herramientas en PATH OK.",
    );
  }
  await page.waitForFunction(
    () => !!window.__testGame?.scene.getScene("trail")?.player,
  );
  const invoke = (command, args) =>
    page.evaluate(
      ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
      { command, args },
    );
  const shared = () => invoke("get_game_state");
  const settled = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".shared-progress small")?.textContent ===
        "Progreso al día",
    );
  await settled();
  assert.equal((await shared()).achievements.length, 0);
  await page.evaluate(() => {
    const game = window.__testGame;
    game.loop.stop();
    const scene = game.scene.getScene("trail");
    window.__testTime = performance.now();
    window.__step = (count = 1) => {
      for (let i = 0; i < count; i++) {
        window.__testTime += 1000 / 60;
        game.headlessStep(window.__testTime, 1000 / 60);
      }
    };
    scene.setFocused(true);
    scene.keys.right.isDown = true;
    window.__step(30);
    scene.keys.right.isDown = false;
    scene.setFocused(false);
  });
  await page
    .locator('[data-achievement="first-coin"][data-unlocked="true"]')
    .waitFor();
  await settled();
  assert.equal((await shared()).collectedCoins, 1);
  assert.equal(
    await page.locator('[data-progress="score"]').innerText(),
    "100",
  );
  console.log("Phaser → Rust → panel: moneda, puntaje y primer logro OK.");

  const media = await invoke("import_video", { path: fixture });
  await invoke("apply_effects", {
    path: media.path,
    start: 0,
    end: 1,
    effects: [],
  });
  assert.equal((await shared()).bonusScore, 0);
  await invoke("apply_effects", {
    path: media.path,
    start: 0,
    end: 1,
    effects: ["grayscale"],
  });
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-hud="score"]').textContent) === 200,
  );
  await settled();
  assert.equal((await shared()).score, 200);
  const jobId = crypto.randomUUID();
  const exportJob = invoke("export_video", {
    request: {
      jobId,
      path: media.path,
      output: path.join(temporary, "export.mp4"),
      start: 0,
      end: 2,
      effects: ["sepia"],
      settings: {
        format: "mp4",
        quality: "medium",
        resolution: "original",
        fps: 24,
      },
    },
  });
  await page.evaluate(() => {
    const scene = window.__testGame.scene.getScene("trail");
    scene.setFocused(true);
    window.__step(120);
    scene.setFocused(false);
  });
  await exportJob;
  await page.waitForFunction(
    () =>
      Number(document.querySelector('[data-hud="score"]').textContent) === 700,
  );
  await settled();
  let state = await shared();
  assert.equal(state.score, 700);
  assert.equal(state.coins, 7);
  assert.equal(state.bonusScore, 600);
  const beforeFailure = state.revision;
  await assert.rejects(
    invoke("apply_effects", {
      path: media.path,
      start: 0,
      end: 1,
      effects: ["invalid"],
    }),
  );
  await assert.rejects(
    invoke("update_game_state", {
      update: {
        action: "progress",
        runId: state.runId,
        sequence: state.sequence + 1,
        acknowledgedRewardRevision: 2,
        progress: {
          gameplayScore: 9999,
          level: 1,
          lives: 3,
          collectedCoins: 1,
          defeated: 0,
          timeLeft: 170,
          shieldSeconds: 15,
          checkpoint: false,
          status: "running",
        },
      },
    }),
  );
  assert.equal((await shared()).revision, beforeFailure);
  console.log(
    "Editor y juego concurrentes: premios reales sin pérdida de progreso; rechazo de datos inválidos OK.",
  );

  await page.evaluate(() => {
    const scene = window.__testGame.scene.getScene("trail");
    scene.setFocused(true);
    // Collect coins through the actual Arcade overlap callbacks.
    for (const coin of scene.coins.getChildren()) {
      if (!coin.active) continue;
      scene.player.body.reset(coin.x, coin.y);
      scene.player.setVelocity(0);
      window.__step(2);
    }
    const enemy = scene.enemies.getChildren()[0];
    enemy.setVelocityX(0);
    scene.player.body.reset(enemy.x, 330);
    scene.player.setVelocity(0, 250);
    window.__step(30);
    scene.player.body.reset(1600, 396);
    scene.player.setVelocity(0);
    window.__step(5);
    scene.player.body.reset(3085, 396);
    scene.player.setVelocity(0);
    window.__step(2);
  });
  await page
    .locator('[data-achievement="flawless"][data-unlocked="true"]')
    .waitFor();
  await settled();
  state = await shared();
  assert.equal(state.achievements.length, 6);
  assert.equal(state.statistics.wins, 1);
  assert.equal(state.statistics.collectedCoins, 24);
  assert.equal(state.statistics.defeated, 1);
  const wonScore = state.score;
  await page.locator("#achievements").screenshot({
    path: path.join(
      root,
      values["clean-env"]
        ? "tmp/installed-achievements.png"
        : "docs/rb11-rb12.png",
    ),
  });
  await page.getByRole("button", { name: "Reiniciar nivel" }).click();
  await page.evaluate(() => window.__step(30));
  await settled();
  state = await shared();
  assert.equal(state.achievements.length, 6);
  assert.equal(state.statistics.wins, 1);
  assert.equal(state.statistics.bestScore, wonScore);
  assert.equal(state.collectedCoins, 0);
  assert.equal(state.score, 600);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Empezar aventura" }).waitFor();
  await settled();
  state = await shared();
  assert.equal(state.achievements.length, 6);
  assert.equal(state.score, 600);
  assert.equal(state.statistics.wins, 1);
  assert.equal(state.statistics.collectedCoins, 24);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Seis logros, récord, victoria única, reinicio, recarga y diseño móvil OK.",
  );
} finally {
  await browser?.close();
  app.kill();
}
