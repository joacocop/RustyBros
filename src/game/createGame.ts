import Phaser from "phaser";
import {
  coinPositions,
  enemyRoutes,
  platforms,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type LevelState,
} from "./level";

export function createGame(
  host: HTMLDivElement,
  onState: (state: LevelState) => void,
) {
  let activeScene: TrailScene;
  let focused = false;

  class TrailScene extends Phaser.Scene {
    player!: Phaser.Physics.Arcade.Sprite;
    enemies!: Phaser.Physics.Arcade.Group;
    keys!: Record<string, Phaser.Input.Keyboard.Key>;
    state: LevelState = {
      status: "ready",
      coins: 0,
      totalCoins: coinPositions.length,
      defeated: 0,
    };
    constructor() {
      super("trail");
    }
    publish() {
      onState({ ...this.state });
    }
    create() {
      activeScene = this;
      this.state = {
        status: focused ? "running" : "ready",
        coins: 0,
        totalCoins: coinPositions.length,
        defeated: 0,
      };
      this.cameras.main.setBackgroundColor("#182e32");
      this.physics.world.setBounds(0, -200, WORLD_WIDTH, WORLD_HEIGHT + 500);
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      const art = this.add.graphics();
      // Distant mountains and woodland are drawn locally; the game needs no remote assets.
      art.fillStyle(0x284345);
      art.fillTriangle(0, 360, 220, 110, 440, 360);
      art.fillTriangle(330, 360, 560, 170, 790, 360);
      art.fillTriangle(680, 360, 880, 100, 1100, 360);
      art.setScrollFactor(0.15);
      this.add.circle(765, 95, 38, 0xeac4a0).setScrollFactor(0.05);
      for (let x = 60; x < WORLD_WIDTH; x += 180) {
        const trees = this.add.graphics().setScrollFactor(0.55);
        trees.fillStyle(0x233d38);
        trees.fillRect(x + 22, 275, 14, 140);
        trees.fillTriangle(x - 20, 330, x + 29, 160 + (x % 40), x + 80, 330);
      }
      if (!this.textures.exists("runner")) this.makeTextures();
      const solid = this.physics.add.staticGroup();
      for (const p of platforms) {
        const block = this.add
          .rectangle(p.x, p.y, p.width, p.height, 0x394b3d)
          .setOrigin(0);
        this.physics.add.existing(block, true);
        solid.add(block);
        this.add.rectangle(p.x, p.y, p.width, 7, 0xa3af78).setOrigin(0);
        for (let tile = p.x + 10; tile < p.x + p.width; tile += 32)
          this.add.rectangle(tile, p.y + 18, 13, 4, 0x516148).setOrigin(0);
      }
      this.player = this.physics.add.sprite(72, 380, "runner");
      this.player.setSize(22, 34).setOffset(5, 6).setMaxVelocity(280, 650);
      this.physics.add.collider(this.player, solid);
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -160, 0);
      const coins = this.physics.add.staticGroup();
      for (const [x, y] of coinPositions) {
        const coin = coins.create(x, y, "coin") as Phaser.Physics.Arcade.Sprite;
        coin.setCircle(9, 1, 1);
        this.tweens.add({
          targets: coin,
          y: y - 5,
          duration: 650,
          yoyo: true,
          repeat: -1,
        });
      }
      this.physics.add.overlap(this.player, coins, (_player, item) => {
        const coin = item as Phaser.Physics.Arcade.Sprite;
        if (!coin.active) return;
        coin.disableBody(true, true);
        this.state.coins += 1;
        this.publish();
        const text = this.add.text(coin.x - 10, coin.y - 20, "+1", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#ffe1a2",
        });
        this.tweens.add({
          targets: text,
          y: text.y - 30,
          alpha: 0,
          duration: 600,
          onComplete: () => text.destroy(),
        });
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
          .setData("route", route);
      }
      this.physics.add.collider(this.enemies, solid);
      this.physics.add.collider(this.player, this.enemies, (_p, item) => {
        const enemy = item as Phaser.Physics.Arcade.Sprite;
        const body = this.player.body as Phaser.Physics.Arcade.Body;
        if (
          body.touching.down &&
          (enemy.body as Phaser.Physics.Arcade.Body).touching.up
        ) {
          enemy.disableBody(true, true);
          this.player.setVelocityY(-300);
          this.state.defeated += 1;
          this.publish();
        } else this.finish(false);
      });
      this.add.rectangle(3100, 338, 5, 156, 0xd7d9b7);
      const flag = this.add
        .triangle(3104, 264, 0, 0, 66, 20, 0, 42, 0xec9b78)
        .setOrigin(0);
      this.tweens.add({
        targets: flag,
        scaleX: 0.9,
        yoyo: true,
        repeat: -1,
        duration: 800,
      });
      this.add.text(3010, 230, "ÚLTIMO CORTE", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#c5d2ba",
      });
      this.add.text(42, 300, "EL SENDERO DEL ÓXIDO", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#b6c4aa",
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
      this.physics.world.pause();
      if (focused) this.physics.world.resume();
      this.publish();
    }
    makeTextures() {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x172a2b);
      g.fillRect(7, 30, 8, 10);
      g.fillRect(19, 30, 8, 10);
      g.fillStyle(0xdb956f);
      g.fillRect(8, 6, 20, 17);
      g.fillStyle(0xf1c8a1);
      g.fillRect(10, 10, 18, 11);
      g.fillStyle(0x27302a);
      g.fillRect(6, 4, 22, 7);
      g.fillRect(23, 14, 3, 3);
      g.fillStyle(0x9eaf83);
      g.fillRect(6, 23, 23, 12);
      g.fillStyle(0xe78d6e);
      g.fillRect(5, 21, 25, 5);
      g.fillRect(1, 24, 9, 5);
      g.generateTexture("runner", 32, 40);
      g.clear();
      g.fillStyle(0x9e5948);
      g.fillRect(2, 10, 28, 15);
      g.fillStyle(0xd88c67);
      g.fillRect(6, 4, 20, 17);
      g.fillStyle(0x172a2b);
      g.fillRect(6, 24, 7, 5);
      g.fillRect(20, 24, 7, 5);
      g.fillRect(9, 12, 4, 4);
      g.fillRect(21, 12, 4, 4);
      g.generateTexture("bug", 32, 30);
      g.clear();
      g.fillStyle(0xe2b96c);
      g.fillCircle(10, 10, 9);
      g.fillStyle(0xffdf99);
      g.fillRect(8, 4, 4, 12);
      g.generateTexture("coin", 20, 20);
      g.destroy();
    }
    finish(won: boolean) {
      if (this.state.status !== "running") return;
      this.player.setVelocity(0);
      this.physics.world.pause();
      this.state.status = won ? "won" : "lost";
      this.publish();
    }
    setFocused(value: boolean) {
      focused = value;
      if (this.state.status === "won" || this.state.status === "lost") return;
      this.state.status = value ? "running" : "paused";
      if (value) this.physics.world.resume();
      else {
        this.player.setVelocityX(0);
        this.physics.world.pause();
        this.input.keyboard?.resetKeys();
      }
      this.publish();
    }
    update(time: number) {
      if (!this.keys) return;
      if (Phaser.Input.Keyboard.JustDown(this.keys.restart)) {
        this.scene.restart();
        return;
      }
      if (
        Phaser.Input.Keyboard.JustDown(this.keys.pause) ||
        Phaser.Input.Keyboard.JustDown(this.keys.escape)
      ) {
        this.setFocused(this.state.status !== "running");
      }
      if (this.state.status !== "running") return;
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const direction =
        this.keys.left.isDown || this.keys.a.isDown
          ? -1
          : this.keys.right.isDown || this.keys.d.isDown
            ? 1
            : 0;
      this.player.setVelocityX(direction * 230);
      if (direction) this.player.setFlipX(direction < 0);
      if (body.blocked.down || body.touching.down) {
        if (
          Phaser.Input.Keyboard.JustDown(this.keys.up) ||
          Phaser.Input.Keyboard.JustDown(this.keys.w) ||
          Phaser.Input.Keyboard.JustDown(this.keys.jump)
        )
          this.player.setVelocityY(-490);
      }
      this.player.setAngle(
        direction && body.blocked.down ? Math.sin(time / 65) * 3 : 0,
      );
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
      if (this.player.y > WORLD_HEIGHT + 50 || this.player.x < -20)
        this.finish(false);
      else if (this.player.x >= 3080) this.finish(true);
      if (this.player.x < 12) this.player.x = 12;
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
  host.addEventListener("focus", focus);
  host.addEventListener("blur", blur);
  host.addEventListener("pointerdown", pointer);
  document.addEventListener("visibilitychange", visibility);
  return {
    game,
    restart: () => {
      focused = true;
      host.focus({ preventScroll: true });
      activeScene?.scene.restart();
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
      document.removeEventListener("visibilitychange", visibility);
      game.destroy(true);
    },
  };
}
