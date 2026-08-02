import { describe, expect, it } from 'vitest';
import { INVADERS, PLAYER, SCORING, WORLD } from '../src/game/config.js';
import { createInitialState, startNewGame } from '../src/game/state.js';
import { stepGame } from '../src/game/update.js';

const idleInput = { left: false, right: false, fire: false };

describe('game state', () => {
  it('creates a complete five-by-ten invader formation', () => {
    const state = createInitialState();

    expect(state.invaders).toHaveLength(INVADERS.rows * INVADERS.columns);
    expect(state.mode).toBe('ready');
    expect(state.lives).toBe(PLAYER.startingLives);
  });

  it('starts a new running game while preserving the high score', () => {
    const state = startNewGame(9001);

    expect(state.mode).toBe('running');
    expect(state.highScore).toBe(9001);
    expect(state.score).toBe(0);
  });
});

describe('game update', () => {
  it('keeps the player inside the defense area', () => {
    const state = startNewGame();
    state.player.x = WORLD.padding;

    stepGame(state, 1, { ...idleInput, left: true });
    expect(state.player.x).toBe(WORLD.padding);

    state.player.x = WORLD.width - WORLD.padding - state.player.width;
    stepGame(state, 1, { ...idleInput, right: true });
    expect(state.player.x).toBe(WORLD.width - WORLD.padding - state.player.width);
  });

  it('fires a player shot after the cooldown expires', () => {
    const state = startNewGame();

    stepGame(state, 0.01, { ...idleInput, fire: true });

    expect(state.bullets.player).toHaveLength(1);
    expect(state.playerShotTimer).toBeGreaterThan(0);
  });

  it('destroys an invader and awards its row score', () => {
    const state = startNewGame();
    const target = state.invaders[0];
    state.enemyShotTimer = 10;
    state.bullets.player = [{
      id: 'test-shot',
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
    }];

    stepGame(state, 0, idleInput);

    expect(state.invaders).toHaveLength(INVADERS.rows * INVADERS.columns - 1);
    expect(state.bullets.player).toHaveLength(0);
    expect(state.score).toBe(SCORING.byRow[0]);
  });

  it('reverses and drops the formation at the right edge', () => {
    const state = startNewGame();
    const right = Math.max(...state.invaders.map((invader) => invader.x + invader.width));
    const shift = WORLD.width - WORLD.padding - right;
    state.invaders.forEach((invader) => { invader.x += shift; });
    const previousY = state.invaders[0].y;

    stepGame(state, 0.05, idleInput);

    expect(state.formation.direction).toBe(-1);
    expect(state.invaders[0].y).toBe(previousY + INVADERS.dropDistance);
  });

  it('advances to a fresh, faster level after clearing a wave', () => {
    const state = startNewGame();
    state.invaders = [];

    stepGame(state, 0, idleInput);

    expect(state.level).toBe(2);
    expect(state.invaders).toHaveLength(INVADERS.rows * INVADERS.columns);
    expect(state.score).toBe(SCORING.levelClear);
    expect(state.formation.speed).toBe(INVADERS.baseSpeed + INVADERS.speedPerLevel);
  });

  it('ends the game when the final ship is hit', () => {
    const state = startNewGame();
    state.lives = 1;
    state.enemyShotTimer = 10;
    state.bullets.enemy = [{
      id: 'enemy-test-shot',
      ...state.player,
    }];

    stepGame(state, 0, idleInput);

    expect(state.lives).toBe(0);
    expect(state.mode).toBe('gameover');
  });
});
