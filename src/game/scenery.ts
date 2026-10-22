import type Phaser from "phaser";
import { platforms } from "./level";

export function createScenery(scene: Phaser.Scene) {
  const art = scene.add.graphics();
  art.fillStyle(0x284345);
  art.fillTriangle(0, 360, 220, 110, 440, 360);
  art.fillTriangle(330, 360, 560, 170, 790, 360);
  art.fillTriangle(680, 360, 880, 100, 1100, 360);
  art.setScrollFactor(0.15);
  scene.add.circle(765, 95, 38, 0xeac4a0).setScrollFactor(0.05);
  for (let x = 60; x < 3200; x += 180) {
    const trees = scene.add.graphics().setScrollFactor(0.55);
    trees.fillStyle(0x233d38);
    trees.fillRect(x + 22, 275, 14, 140);
    trees.fillTriangle(x - 20, 330, x + 29, 160 + (x % 40), x + 80, 330);
  }
  const solid = scene.physics.add.staticGroup();
  for (const p of platforms) {
    const block = scene.add
      .rectangle(p.x, p.y, p.width, p.height, 0x394b3d)
      .setOrigin(0);
    scene.physics.add.existing(block, true);
    solid.add(block);
    scene.add.rectangle(p.x, p.y, p.width, 7, 0xa3af78).setOrigin(0);
    for (let tile = p.x + 10; tile < p.x + p.width; tile += 32)
      scene.add.rectangle(tile, p.y + 18, 13, 4, 0x516148).setOrigin(0);
  }
  scene.add.rectangle(3100, 338, 5, 156, 0xd7d9b7);
  const flag = scene.add
    .triangle(3104, 264, 0, 0, 66, 20, 0, 42, 0xec9b78)
    .setOrigin(0);
  scene.tweens.add({
    targets: flag,
    scaleX: 0.9,
    yoyo: true,
    repeat: -1,
    duration: 800,
  });
  scene.add.text(3010, 230, "ÚLTIMO CORTE", {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#c5d2ba",
  });
  scene.add.text(42, 300, "EL SENDERO DEL ÓXIDO", {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#b6c4aa",
  });
  scene.add.rectangle(1548, 389, 4, 54, 0xc8d0ae);
  const checkpoint = scene.add
    .triangle(1550, 364, 0, 0, 26, 9, 0, 18, 0x62776f)
    .setOrigin(0);
  return { solid, checkpoint };
}
