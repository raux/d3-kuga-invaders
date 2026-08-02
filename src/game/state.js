import { DIVES, INVADERS, PLAYER, WORLD } from './config.js';

export function createInvaderFormation(level = 1) {
  const invaders = [];

  for (let row = 0; row < INVADERS.rows; row += 1) {
    for (let column = 0; column < INVADERS.columns; column += 1) {
      invaders.push({
        id: `invader-${level}-${row}-${column}`,
        row,
        column,
        x: INVADERS.startX + column * (INVADERS.width + INVADERS.gapX),
        y: INVADERS.startY + row * (INVADERS.height + INVADERS.gapY),
        width: INVADERS.width,
        height: INVADERS.height,
      });
    }
  }

  return invaders;
}

export function createInitialState(highScore = 0) {
  const level = 1;

  return {
    mode: 'ready',
    score: 0,
    highScore,
    lives: PLAYER.startingLives,
    level,
    elapsed: 0,
    nextEntityId: 1,
    playerShotTimer: 0,
    enemyShotTimer: 1,
    diveTimer: DIVES.initialDelay,
    invulnerabilityTimer: 0,
    formation: {
      direction: 1,
      speed: INVADERS.baseSpeed + INVADERS.speedPerLevel * (level - 1),
    },
    player: {
      x: (WORLD.width - PLAYER.width) / 2,
      y: PLAYER.y,
      width: PLAYER.width,
      height: PLAYER.height,
    },
    invaders: createInvaderFormation(level),
    bullets: {
      player: [],
      enemy: [],
    },
  };
}

export function startNewGame(highScore = 0) {
  return { ...createInitialState(highScore), mode: 'running' };
}

export function nextId(state, prefix) {
  const id = `${prefix}-${state.nextEntityId}`;
  state.nextEntityId += 1;
  return id;
}
