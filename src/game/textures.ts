import type Phaser from "phaser";

function sheet(
  width: number,
  height: number,
  count: number,
  paint: (context: CanvasRenderingContext2D, frame: number) => void,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width * count;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  for (let frame = 0; frame < count; frame++) {
    context.save();
    context.translate(frame * width, 0);
    paint(context, frame);
    context.restore();
  }
  return canvas;
}

export function createSpriteAnimations(scene: Phaser.Scene) {
  if (!scene.textures.exists("runner")) {
    const runner = sheet(32, 40, 9, (c, frame) => {
      const stride = frame >= 2 && frame <= 5 ? [-3, 0, 3, 0][frame - 2] : 0;
      const jumping = frame === 6,
        falling = frame === 7,
        hurt = frame === 8;
      c.fillStyle = "#172a2b";
      c.fillRect(7 + stride, jumping ? 29 : 30, 7, jumping ? 6 : 10);
      c.fillRect(19 - stride, jumping ? 27 : 30, 7, jumping ? 6 : 10);
      c.fillStyle = "#9eaf83";
      c.fillRect(6, 23, 23, 11);
      c.fillStyle = "#f1c8a1";
      c.fillRect(9, 9, 19, 12);
      c.fillStyle = "#db956f";
      c.fillRect(7, 7, 21, 4);
      c.fillStyle = "#27302a";
      c.fillRect(6, 3, 22, 6);
      c.fillStyle = hurt ? "#b44336" : "#27302a";
      c.fillRect(23, 14, 3, frame === 1 ? 1 : 3);
      c.fillStyle = "#e78d6e";
      c.fillRect(5, 21, 25, 5);
      c.fillRect(1, 24 + stride / 3, 9, 4);
      c.fillStyle = "#f1c8a1";
      c.fillRect(26, falling ? 16 : jumping ? 19 : 27 - stride, 5, 5);
      if (hurt) {
        c.fillStyle = "#edb18e";
        c.fillRect(3, 28, 4, 5);
      }
    });
    scene.textures.addSpriteSheet(
      "runner",
      scene.textures.addCanvas("runner", runner)!,
      { frameWidth: 32, frameHeight: 40 },
    );
    const bug = sheet(32, 30, 4, (c, frame) => {
      c.fillStyle = "#172a2b";
      c.fillRect(5 + (frame % 2) * 3, 24, 7, 5);
      c.fillRect(21 - (frame % 2) * 3, 24, 7, 5);
      c.fillStyle = "#9e5948";
      c.fillRect(2, 11, 28, 14);
      c.fillStyle = "#d88c67";
      c.fillRect(6, frame % 2 ? 5 : 4, 20, 17);
      c.fillStyle = "#172a2b";
      c.fillRect(9, 12, 4, 4);
      c.fillRect(21, 12, 4, 4);
    });
    scene.textures.addSpriteSheet(
      "bug",
      scene.textures.addCanvas("bug", bug)!,
      { frameWidth: 32, frameHeight: 30 },
    );
    const coins = sheet(20, 20, 4, (c, frame) => {
      const width = [16, 10, 4, 10][frame];
      c.fillStyle = "#e2b96c";
      c.fillRect(10 - width / 2, 2, width, 16);
      c.fillStyle = "#ffdf99";
      c.fillRect(10 - width / 4, 4, Math.max(2, width / 4), 12);
    });
    scene.textures.addSpriteSheet(
      "coin",
      scene.textures.addCanvas("coin", coins)!,
      { frameWidth: 20, frameHeight: 20 },
    );
  }
  if (!scene.anims.exists("runner-idle")) {
    scene.anims.create({
      key: "runner-idle",
      frames: [
        { key: "runner", frame: 0, duration: 1800 },
        { key: "runner", frame: 1, duration: 120 },
      ],
      frameRate: 6,
      repeat: -1,
    });
    scene.anims.create({
      key: "runner-run",
      frames: scene.anims.generateFrameNumbers("runner", { start: 2, end: 5 }),
      frameRate: 12,
      repeat: -1,
    });
    for (const [key, frame] of [
      ["runner-jump", 6],
      ["runner-fall", 7],
      ["runner-hurt", 8],
    ] as const)
      scene.anims.create({
        key,
        frames: [{ key: "runner", frame }],
        frameRate: 1,
      });
    scene.anims.create({
      key: "bug-walk",
      frames: scene.anims.generateFrameNumbers("bug", { start: 0, end: 3 }),
      frameRate: 7,
      repeat: -1,
    });
    scene.anims.create({
      key: "coin-spin",
      frames: scene.anims.generateFrameNumbers("coin", { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
  }
}
