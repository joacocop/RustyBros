import Phaser from "phaser";
import { coinPositions, enemyRoutes, WORLD_HEIGHT, WORLD_WIDTH } from "./level";
import {
  advanceClock,
  collectCoin,
  defeatEnemy,
  finishLevel,
  grantReward,
  initialLevel,
  loseLife,
  resumeLife,
  RewardLedger,
  type DeathReason,
  type EditorReward,
  type LevelState,
  type RewardGrant,
} from "./rules";
import { createSpriteAnimations } from "./textures";
import { createScenery } from "./scenery";

export function createGame(
  host: HTMLDivElement,
  onState: (state: LevelState) => void,
  seed: { rewards?: EditorReward[]; shieldSeconds?: number } = {},
) {
  let activeScene: TrailScene | undefined;
  let focused = false;
  let retainedShield = seed.shieldSeconds ?? 0;
  let run = 0;
  const rewards = new RewardLedger();
  for (const reward of seed.rewards ?? []) rewards.accept(reward);

  class TrailScene extends Phaser.Scene {
    player!: Phaser.Physics.Arcade.Sprite;
    enemies!: Phaser.Physics.Arcade.Group;
    coins!: Phaser.Physics.Arcade.StaticGroup;
    keys!: Record<string, Phaser.Input.Keyboard.Key>;
    shield!: Phaser.GameObjects.Arc;
    checkpointFlag!: Phaser.GameObjects.Triangle;
    state = initialLevel(coinPositions.length);
    runClock = 0;
    jumpBufferedUntil = 0;
    lastGroundedAt = -Infinity;
    graceSeconds = 0;
    constructor() {
      super("trail");
    }
    publish() {
      onState({ ...this.state });
    }
    create() {
      activeScene = this;
      this.state = initialLevel(
        coinPositions.length,
        rewards,
        retainedShield,
        focused ? "running" : "ready",
      );
      this.state.run = ++run;
      this.runClock = 0;
      this.jumpBufferedUntil = 0;
      this.lastGroundedAt = -Infinity;
      this.graceSeconds = 0;
      this.cameras.main.setBackgroundColor("#182e32");
      this.physics.world.setBounds(0, -200, WORLD_WIDTH, WORLD_HEIGHT + 500);
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      const { solid, checkpoint } = createScenery(this);
      this.checkpointFlag = checkpoint;
      createSpriteAnimations(this);
      this.player = this.physics.add.sprite(72, 380, "runner");
      this.player
        .setSize(22, 34)
        .setOffset(5, 6)
        .setMaxVelocity(230, 650)
        .setCollideWorldBounds(true)
        .play("runner-idle");
      this.physics.add.collider(this.player, solid);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -160, 0);
      this.shield = this.add
        .circle(72, 380, 26, 0xb9d9c1, 0.08)
        .setStrokeStyle(2, 0xc5ddb4)
        .setDepth(3)
        .setVisible(this.state.shieldSeconds > 0);
      this.coins = this.physics.add.staticGroup();
      for (const [x, y] of coinPositions) {
        const coin = this.coins.create(
          x,
          y,
          "coin",
        ) as Phaser.Physics.Arcade.Sprite;
        coin.setCircle(9, 1, 1).play("coin-spin");
      }
      this.physics.add.overlap(this.player, this.coins, (_player, item) => {
        const coin = item as Phaser.Physics.Arcade.Sprite;
        if (!coin.active || this.state.status !== "running") return;
        coin.disableBody(true, true);
        this.state = collectCoin(this.state);
        this.publish();
        this.floating("+100 · +1 moneda", coin.x, coin.y - 20);
      });
      this.enemies = this.physics.add.group();
      for (const route of enemyRoutes) {
        const enemy = this.enemies.create(
          route.x,
          396,
          "bug",
        ) as Phaser.Physics.Arcade.Sprite;
        enemy
          .setSize(28, 20)
          .setOffset(2, 8)
          .setVelocityX(65)
          .setData("route", route)
          .play("bug-walk");
      }
      this.physics.add.collider(this.enemies, solid);
      this.physics.add.collider(this.player, this.enemies, (_player, item) => {
        const enemy = item as Phaser.Physics.Arcade.Sprite;
        if (this.state.status !== "running" || !enemy.active) return;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        const stomp =
          body.touching.down &&
          (enemy.body as Phaser.Physics.Arcade.Body).touching.up;
        if (stomp || this.state.shieldSeconds > 0) {
          enemy.disableBody(true, true);
          this.state = defeatEnemy(this.state);
          if (stomp) this.player.setVelocityY(-300);
          else {
            this.state.shieldSeconds = 0;
            retainedShield = 0;
            this.graceSeconds = 1.2;
          }
          this.floating(
            stomp ? "+200" : "¡Escudo! +200",
            enemy.x,
            enemy.y - 24,
          );
          this.publish();
        } else if (this.graceSeconds <= 0) this.hurt("enemy");
      });
      this.keys = this.input.keyboard!.addKeys({
        left: "LEFT",
        right: "RIGHT",
        up: "UP",
        a: "A",
        d: "D",
        w: "W",
        jump: "SPACE",
        restart: "R",
        pause: "P",
        escape: "ESC",
      }) as Record<string, Phaser.Input.Keyboard.Key>;
      for (const name of ["up", "w", "jump"]) {
        this.keys[name].on("down", () => {
          if (this.state.status === "running")
            this.jumpBufferedUntil = this.runClock + 120;
        });
        this.keys[name].on("up", () => {
          const body = this.player.body as Phaser.Physics.Arcade.Body;
          if (this.state.status === "running" && body.velocity.y < -210)
            this.player.setVelocityY(-210);
        });
      }
      if (focused) {
        this.physics.world.resume();
        this.anims.resumeAll();
      } else this.physics.world.pause();
      this.events.once("shutdown", () => {
        retainedShield = this.state.shieldSeconds;
        if (activeScene === this) activeScene = undefined;
      });
      this.publish();
    }
    floating(label: string, x = this.player.x, y = this.player.y - 36) {
      const text = this.add
        .text(x - 10, y, label, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#ffe1a2",
          backgroundColor: "#17302bcc",
          padding: { x: 4, y: 3 },
        })
        .setDepth(5);
      this.tweens.add({
        targets: text,
        y: y - 30,
        alpha: 0,
        duration: 1000,
        onComplete: () => text.destroy(),
      });
    }
    receiveReward(grant: RewardGrant) {
      this.state = grantReward(this.state, grant);
      retainedShield = this.state.shieldSeconds;
      this.shield.setVisible(true).setPosition(this.player.x, this.player.y);
      this.floating(
        `+${grant.points} · +${grant.coins} moneda${grant.coins > 1 ? "s" : ""} · Escudo`,
      );
      this.publish();
    }
    stopForLifeLoss() {
      retainedShield = 0;
      this.player.setVelocity(0).clearTint().setAlpha(1).play("runner-hurt");
      this.shield.setVisible(false);
      this.physics.world.pause();
      this.cameras.main.shake(160, 0.006);
      this.input.keyboard?.resetKeys();
      this.publish();
    }
    hurt(reason: DeathReason) {
      if (this.state.status !== "running") return;
      this.state = loseLife(this.state, reason);
      this.stopForLifeLoss();
    }
    respawn() {
      if (this.state.status !== "respawning") return;
      this.state = resumeLife(this.state);
      this.graceSeconds = 1.5;
      this.jumpBufferedUntil = 0;
      this.lastGroundedAt = -Infinity;
      this.player.body!.reset(this.state.checkpoint ? 1580 : 72, 380);
      this.player.setVelocity(0).setAlpha(1).clearTint().play("runner-idle");
      this.physics.world.resume();
      this.publish();
    }
    setFocused(value: boolean) {
      focused = value;
      if (["won", "lost", "respawning"].includes(this.state.status)) return;
      this.state.status = value ? "running" : "paused";
      if (value) {
        this.physics.world.resume();
        this.anims.resumeAll();
      } else {
        this.player.setVelocityX(0);
        this.physics.world.pause();
        this.anims.pauseAll();
        this.input.keyboard?.resetKeys();
        this.jumpBufferedUntil = 0;
      }
      this.publish();
    }
    update(_time: number, delta: number) {
      if (!this.player || this.state.status !== "running") return;
      const seconds = Math.min(delta, 100) / 1000;
      this.runClock += seconds * 1000;
      const oldTime = Math.ceil(this.state.timeLeft),
        oldShield = Math.ceil(this.state.shieldSeconds);
      this.state = advanceClock(this.state, seconds);
      retainedShield = this.state.shieldSeconds;
      if (this.state.status !== "running") {
        this.stopForLifeLoss();
        return;
      }
      this.graceSeconds = Math.max(0, this.graceSeconds - seconds);
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const grounded = body.blocked.down || body.touching.down;
      if (grounded) this.lastGroundedAt = this.runClock;
      const direction =
        this.keys.left.isDown || this.keys.a.isDown
          ? -1
          : this.keys.right.isDown || this.keys.d.isDown
            ? 1
            : 0;
      this.player.setVelocityX(direction * 230);
      if (direction) this.player.setFlipX(direction < 0);
      if (
        ["up", "w", "jump"].some((name) =>
          Phaser.Input.Keyboard.JustDown(this.keys[name]),
        )
      )
        this.jumpBufferedUntil = this.runClock + 120;
      if (
        this.jumpBufferedUntil > 0 &&
        this.runClock <= this.jumpBufferedUntil &&
        this.runClock - this.lastGroundedAt <= 100
      ) {
        this.player.setVelocityY(-490);
        this.jumpBufferedUntil = 0;
        this.lastGroundedAt = -Infinity;
      }
      const animation =
        body.velocity.y < -20
          ? "runner-jump"
          : body.velocity.y > 20
            ? "runner-fall"
            : direction
              ? "runner-run"
              : "runner-idle";
      this.player
        .play(animation, true)
        .setAlpha(
          this.graceSeconds > 0 && Math.floor(this.graceSeconds * 10) % 2
            ? 0.45
            : 1,
        );
      this.shield
        .setPosition(this.player.x, this.player.y)
        .setVisible(this.state.shieldSeconds > 0);
      for (const object of this.enemies.getChildren()) {
        const enemy = object as Phaser.Physics.Arcade.Sprite;
        if (!enemy.active) continue;
        const route = enemy.getData("route") as (typeof enemyRoutes)[number];
        if (enemy.x >= route.right) enemy.setVelocityX(-65);
        else if (enemy.x <= route.left) enemy.setVelocityX(65);
        enemy.setFlipX(
          (enemy.body as Phaser.Physics.Arcade.Body).velocity.x < 0,
        );
      }
      if (!this.state.checkpoint && this.player.x >= 1580 && grounded) {
        this.state.checkpoint = true;
        this.checkpointFlag.setFillStyle(0xec9b78);
        this.floating("Posta activada");
        this.publish();
      }
      if (this.player.y > WORLD_HEIGHT + 50) this.hurt("fall");
      else if (this.player.x >= 3080) {
        this.state = finishLevel(this.state);
        this.player.setVelocity(0).play("runner-idle");
        this.physics.world.pause();
        this.publish();
      } else if (
        oldTime !== Math.ceil(this.state.timeLeft) ||
        oldShield !== Math.ceil(this.state.shieldSeconds)
      )
        this.publish();
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: 960,
    height: WORLD_HEIGHT,
    backgroundColor: "#182e32",
    pixelArt: true,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: { target: host } },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 1100 }, debug: false },
    },
    scene: TrailScene,
  });
  const focus = () => activeScene?.setFocused(true);
  const blur = () => activeScene?.setFocused(false);
  const pointer = () => host.focus({ preventScroll: true });
  const visibility = () => {
    if (document.hidden) blur();
  };
  const windowBlur = () => blur();
  // Handle commands before Phaser queues the event: resetting held movement keys
  // while pausing must not replay the same command on key-up.
  const commandKey = (event: KeyboardEvent) => {
    if (!["KeyP", "Escape", "KeyR"].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat || !activeScene) return;
    if (event.code === "KeyR") {
      focused = true;
      activeScene.scene.restart();
    } else activeScene.setFocused(activeScene.state.status !== "running");
  };
  host.addEventListener("focus", focus);
  host.addEventListener("blur", blur);
  host.addEventListener("pointerdown", pointer);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", windowBlur);
  host.addEventListener("keydown", commandKey, true);
  return {
    game,
    reward: (reward: EditorReward) => {
      const grant = rewards.accept(reward);
      if (!grant) return false;
      if (activeScene?.sys.isActive()) activeScene.receiveReward(grant);
      else retainedShield = Math.max(retainedShield, grant.shieldSeconds);
      return true;
    },
    restart: () => {
      retainedShield = activeScene?.state.shieldSeconds ?? retainedShield;
      focused = true;
      host.focus({ preventScroll: true });
      activeScene?.scene.restart();
    },
    respawn: () => {
      focused = true;
      host.focus({ preventScroll: true });
      activeScene?.respawn();
    },
    play: () => {
      host.focus({ preventScroll: true });
      focus();
    },
    pause: blur,
    destroy: () => {
      host.removeEventListener("focus", focus);
      host.removeEventListener("blur", blur);
      host.removeEventListener("pointerdown", pointer);
      host.removeEventListener("keydown", commandKey, true);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", windowBlur);
      game.destroy(true);
    },
  };
}
