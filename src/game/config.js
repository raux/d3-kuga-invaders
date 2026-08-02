export const WORLD = Object.freeze({
  width: 960,
  height: 640,
  padding: 28,
});

export const PLAYER = Object.freeze({
  width: 56,
  height: 28,
  y: 574,
  speed: 430,
  shotCooldown: 0.24,
  invulnerabilitySeconds: 1.15,
  startingLives: 3,
});

export const INVADERS = Object.freeze({
  rows: 5,
  columns: 10,
  width: 40,
  height: 28,
  gapX: 24,
  gapY: 17,
  startX: 112,
  startY: 92,
  baseSpeed: 48,
  speedPerLevel: 9,
  dropDistance: 24,
  floorY: 548,
});

export const DIVES = Object.freeze({
  initialDelay: 3.5,
  minInterval: 2.2,
  maxInterval: 4.6,
  intervalLevelReduction: 0.12,
  verticalSpeed: 210,
  speedPerLevel: 12,
  maxVerticalSpeed: 420,
  maxHorizontalSpeed: 380,
  levelsPerExtraDiver: 3,
  maxActive: 3,
});

export const BULLETS = Object.freeze({
  playerWidth: 4,
  playerHeight: 18,
  playerSpeed: 610,
  enemyWidth: 5,
  enemyHeight: 16,
  enemySpeed: 260,
});

export const SCORING = Object.freeze({
  byRow: [40, 30, 20, 20, 10],
  levelClear: 250,
});
