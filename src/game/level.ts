export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 480;
export const GROUND_Y = 416;
export const platforms = [
  { x: 0, y: GROUND_Y, width: 640, height: 64 },
  { x: 736, y: GROUND_Y, width: 688, height: 64 },
  { x: 1520, y: GROUND_Y, width: 704, height: 64 },
  { x: 2320, y: GROUND_Y, width: 880, height: 64 },
  { x: 270, y: 340, width: 128, height: 20 },
  { x: 460, y: 270, width: 128, height: 20 },
  { x: 900, y: 336, width: 160, height: 20 },
  { x: 1200, y: 284, width: 128, height: 20 },
  { x: 1700, y: 340, width: 160, height: 20 },
  { x: 1920, y: 270, width: 128, height: 20 },
  { x: 2470, y: 340, width: 160, height: 20 },
  { x: 2750, y: 270, width: 128, height: 20 },
];
export const coinPositions = [
  [160, 374],
  [300, 306],
  [360, 306],
  [490, 236],
  [550, 236],
  [620, 320],
  [790, 374],
  [930, 302],
  [1010, 302],
  [1230, 250],
  [1290, 250],
  [1390, 320],
  [1580, 374],
  [1740, 306],
  [1810, 306],
  [1950, 236],
  [2010, 236],
  [2190, 320],
  [2390, 374],
  [2510, 306],
  [2580, 306],
  [2780, 236],
  [2840, 236],
  [3000, 374],
];
export const enemyRoutes = [
  { x: 500, left: 430, right: 595 },
  { x: 1140, left: 1085, right: 1320 },
  { x: 2020, left: 2000, right: 2050 },
  { x: 2940, left: 2900, right: 2990 },
];
export type { GameStatus, LevelState } from "./rules";
