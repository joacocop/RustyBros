import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: false },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  for (const channel of ["chrome", "msedge", undefined]) {
    try {
      browser = await chromium.launch({ channel, headless: true });
      break;
    } catch (error) {
      if (!channel) throw error;
    }
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  // Dispatch a rapid tap in the same task so slow CI/browser scheduling cannot
  // leave the runner unattended before the pause assertion.
  await page
    .getByRole("button", { name: "Empezar aventura" })
    .evaluate((button) => {
      button.click();
      const host = document.querySelector("[data-game]");
      host.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyP", key: "p", bubbles: true }),
      );
      host.dispatchEvent(
        new KeyboardEvent("keyup", { code: "KeyP", key: "p", bubbles: true }),
      );
    });
  await page.getByRole("button", { name: "Continuar" }).waitFor();
  const paused = await page.locator("[data-hud=time]").innerText();
  await page.waitForTimeout(1100);
  assert.equal(await page.locator("[data-hud=time]").innerText(), paused);
  await page.getByRole("button", { name: "Continuar" }).evaluate((button) => {
    button.click();
    document
      .querySelector("[data-game]")
      .dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyR", key: "r", bubbles: true }),
      );
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("[data-hud=score]").innerText(), "000000");

  console.log("Interfaz: pausa rápida, reloj detenido y reinicio OK.");
  const result = await page.evaluate(async () => {
    const { createGame } = await import("/src/game/createGame.ts");
    const host = document.createElement("div");
    host.tabIndex = 0;
    host.style.cssText = "width:960px;height:480px";
    document.body.append(host);
    let current;
    const controller = createGame(host, (state) => (current = state));
    // A reward arriving before Scene.create must survive boot.
    controller.reward({ id: "before-boot", kind: "effect" });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("La escena no terminó de cargar.")),
        15000,
      );
      const wait = () => {
        if (current) {
          clearTimeout(timeout);
          resolve();
        } else requestAnimationFrame(wait);
      };
      wait();
    });
    controller.play();
    controller.game.loop.stop();
    const scene = controller.game.scene.getScene("trail");
    let time = performance.now();
    const step = (count = 1) => {
      for (let i = 0; i < count; i++) {
        time += 1000 / 60;
        controller.game.headlessStep(time, 1000 / 60);
      }
    };
    const snapshot = () => ({ ...scene.state });
    step(30);
    const beforeBoot = snapshot();
    const grounded = Math.round(scene.player.body.bottom);
    const idle = scene.player.anims.currentAnim.key;
    scene.keys.right.isDown = true;
    step(10);
    const runFrame = scene.player.frame.name;
    step(5);
    const animated =
      scene.player.anims.currentAnim.key === "runner-run" &&
      runFrame !== scene.player.frame.name;
    scene.keys.right.isDown = false;
    scene.keys.jump.emit("down");
    step(3);
    const jump = {
      velocity: scene.player.body.velocity.y,
      animation: scene.player.anims.currentAnim.key,
    };
    step(6);
    const beforeDouble = scene.player.body.velocity.y;
    scene.keys.jump.emit("down");
    step();
    const noDoubleJump = scene.player.body.velocity.y > beforeDouble;
    scene.keys.jump.emit("up");
    const cutJump = scene.player.body.velocity.y;
    step(15);
    const falling = scene.player.anims.currentAnim.key;
    step(45);
    // Test a buffered jump immediately before landing.
    scene.player.body.reset(120, 391);
    scene.player.setVelocity(0, 150);
    scene.lastGroundedAt = -Infinity;
    scene.keys.jump.emit("down");
    let buffered = false;
    for (let i = 0; i < 8; i++) {
      step();
      if (scene.player.body.velocity.y < 0) {
        buffered = true;
        break;
      }
    }
    step(60);
    // Coyote time allows a jump just after leaving a platform.
    scene.player.body.reset(630, 396);
    scene.player.setVelocity(0);
    scene.keys.right.isDown = true;
    step(7);
    scene.keys.jump.emit("down");
    step();
    const coyote = scene.player.body.velocity.y < 0;
    scene.keys.right.isDown = false;
    // Pause freezes both clocks and rewards do not steal the focus.
    controller.pause();
    const firstReward = controller.reward({ id: "export-one", kind: "export" });
    const duplicate = controller.reward({ id: "export-one", kind: "export" });
    const atPause = snapshot();
    step(120);
    const afterPause = snapshot();
    controller.restart();
    step(30);
    const walletOnReset = snapshot();
    // Actual side collision consumes the shield, preserving all three lives.
    const enemy = scene.enemies.getChildren()[0];
    scene.player.body.reset(enemy.x - 20, 396);
    scene.player.setVelocity(230, 0);
    step(3);
    const shieldHit = snapshot();
    // Removing the shield and the brief grace period exercises the real damage collider.
    const second = scene.enemies.getChildren()[1];
    scene.graceSeconds = 0;
    scene.player.body.reset(second.x - 20, 396);
    scene.player.setVelocity(230, 0);
    step(3);
    const hit = snapshot();
    step(30);
    const singleLoss = snapshot();
    controller.respawn();
    step(30);
    const respawn = snapshot();
    scene.player.body.reset(1600, 396);
    scene.player.setVelocity(0);
    step(5);
    const checkpoint = scene.state.checkpoint;
    scene.player.body.reset(1470, 525);
    scene.player.setVelocity(0, 300);
    step(4);
    const fall = snapshot();
    controller.respawn();
    step(4);
    const checkpointX = Math.round(scene.player.x);
    scene.state.timeLeft = 0.01;
    step(3);
    const timeout = snapshot();
    step(30);
    const noExtraLoss = snapshot();
    controller.restart();
    step(30);
    const newRun = snapshot();
    // A downward collision defeats an enemy and bounces without a shield.
    const stompTarget = scene.enemies.getChildren()[0];
    stompTarget.setVelocityX(0);
    scene.player.body.reset(stompTarget.x, 330);
    scene.player.setVelocity(0, 250);
    let bounced = false;
    for (let i = 0; i < 30; i++) {
      step();
      if (scene.player.body.velocity.y < 0) bounced = true;
    }
    const stomp = snapshot();
    controller.restart();
    step(30);
    // Traverse the unchanged level using actual gravity and collisions, without teleporting.
    scene.keys.right.isDown = true;
    for (let i = 0; i < 1500 && scene.state.status === "running"; i++) {
      const player = scene.player,
        body = player.body;
      const nearEnemy = scene.enemies
        .getChildren()
        .some(
          (enemy) =>
            enemy.active && enemy.x > player.x - 10 && enemy.x - player.x < 105,
        );
      const nearGap = [640, 1424, 2224].some(
        (x) => x > player.x && x - player.x < 95,
      );
      if ((body.blocked.down || body.touching.down) && (nearEnemy || nearGap))
        scene.keys.jump.emit("down");
      step();
    }
    const complete = snapshot();
    controller.destroy();
    host.remove();
    return {
      beforeBoot,
      grounded,
      idle,
      animated,
      jump,
      noDoubleJump,
      cutJump,
      falling,
      buffered,
      coyote,
      firstReward,
      duplicate,
      atPause,
      afterPause,
      walletOnReset,
      shieldHit,
      hit,
      singleLoss,
      respawn,
      checkpoint,
      fall,
      checkpointX,
      timeout,
      noExtraLoss,
      newRun,
      stomp,
      bounced,
      complete,
    };
  });
  assert.equal(result.beforeBoot.bonusCoins, 1);
  assert.equal(result.grounded, 416);
  assert.equal(result.idle, "runner-idle");
  assert(result.animated);
  assert(result.jump.velocity < 0);
  assert.equal(result.jump.animation, "runner-jump");
  assert(result.noDoubleJump);
  assert(result.cutJump >= -210);
  assert.equal(result.falling, "runner-fall");
  assert(result.buffered);
  assert(result.coyote);
  assert(result.firstReward);
  assert(!result.duplicate);
  assert.equal(result.atPause.score, result.afterPause.score);
  assert.equal(result.atPause.timeLeft, result.afterPause.timeLeft);
  assert.equal(result.atPause.shieldSeconds, result.afterPause.shieldSeconds);
  assert.equal(result.walletOnReset.score, 600);
  assert.equal(result.walletOnReset.bonusCoins, 6);
  assert.equal(result.shieldHit.lives, 3);
  assert.equal(result.shieldHit.shieldSeconds, 0);
  assert.equal(result.shieldHit.defeated, 1);
  assert.equal(result.hit.lives, 2);
  assert.equal(result.singleLoss.lives, 2);
  assert.equal(result.hit.status, "respawning");
  assert.equal(result.respawn.status, "running");
  assert.equal(result.respawn.lives, 2);
  assert(result.checkpoint);
  assert.equal(result.fall.lives, 1);
  assert.equal(result.checkpointX, 1580);
  assert.equal(result.timeout.lives, 0);
  assert.equal(result.noExtraLoss.lives, 0);
  assert.equal(result.timeout.status, "lost");
  assert.equal(result.newRun.lives, 3);
  assert.equal(result.newRun.collectedCoins, 0);
  assert.equal(result.newRun.score, 600);
  assert.equal(result.stomp.defeated, 1);
  assert.equal(result.stomp.lives, 3);
  assert.equal(result.stomp.score, 800);
  assert(result.bounced);
  assert.equal(result.complete.status, "won");
  assert(result.complete.collectedCoins > 0);
  assert(result.complete.score > 600);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Phaser real: gravedad, colisiones, animaciones, salto variable/buffer/coyote, HUD, vidas, posta, reloj, escudo, deduplicación, reinicio y victoria OK.",
  );
} finally {
  await browser?.close();
  await server.close();
}
