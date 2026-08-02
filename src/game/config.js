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
  levelsPerExtraDiver: 1,
  maxActive: 5,
  eliteMinimumLevel: 2,
  eliteBaseChance: 0.08,
  eliteChancePerLevel: 0.025,
  eliteMaxChance: 0.28,
  eliteVerticalSpeedMultiplier: 1.55,
  eliteHorizontalSpeedMultiplier: 1.25,
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
  byRow: [50, 40, 30, 20, 10],
  divingMultiplier: 2,
  eliteDivingMultiplier: 5,
  levelClear: 250,
});

export const COMBO = Object.freeze({
  maxStacks: 15,
  stacksPerTier: 3,
  graceSeconds: 2.2,
  decaySeconds: 0.75,
  fireRatePerStack: 0.03,
  minimumCooldownMultiplier: 0.55,
  bulletSpeedPerStack: 0.015,
  maximumBulletSpeedBonus: 0.25,
  bulletScalePerStack: 0.025,
  maximumBulletScaleBonus: 0.4,
  overdriveMinimumStacks: 12,
  tierNames: Object.freeze(['Warmup', 'Velocity', 'Surge', 'Power', 'Kuga Overdrive']),
});

export const FEEDBACK = Object.freeze({
  scorePopupSeconds: 0.72,
  scorePopupRiseSpeed: 46,
  explosionParticleCount: 12,
  playerHitParticleCount: 20,
  particleSeconds: 0.48,
  particleDrag: 0.94,
  particleGravity: 52,
  shockwaveSeconds: 0.42,
  shockwaveBaseRadius: 38,
  shockwaveRadiusPerTier: 13,
  tierAnnouncementSeconds: 0.9,
  hitShakeSeconds: 0.09,
  hitShakeStrength: 3,
  eliteShakeSeconds: 0.16,
  eliteShakeStrength: 6,
  playerShakeSeconds: 0.28,
  playerShakeStrength: 11,
});
