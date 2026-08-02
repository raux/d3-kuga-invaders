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
    expect(state.diveTimer).toBeGreaterThan(0);
  });

  it('assigns a distinct value to every enemy row', () => {
    expect(SCORING.byRow).toEqual([50, 40, 30, 20, 10]);
    expect(new Set(SCORING.byRow).size).toBe(INVADERS.rows);
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

  it('positions the player under a drag target', () => {
    const state = startNewGame();

    stepGame(state, 0.01, { ...idleInput, targetX: WORLD.width * 0.75 });

    expect(state.player.x).toBe(WORLD.width * 0.75 - state.player.width / 2);
  });

  it('launches a random bottom-row invader toward the player', () => {
    const state = startNewGame();
    state.diveTimer = 0;
    state.enemyShotTimer = 10;

    stepGame(state, 0, idleInput, () => 0);

    const divers = state.invaders.filter((invader) => invader.diving);
    expect(divers).toHaveLength(1);
    expect(divers[0].row).toBe(INVADERS.rows - 1);
    expect(divers[0].velocityY).toBeGreaterThan(0);
    expect(state.diveTimer).toBeGreaterThan(0);
  });

  it('adds one simultaneous diver per level up to five', () => {
    for (let level = 1; level <= 6; level += 1) {
      const state = startNewGame();
      state.level = level;
      const existingDivers = Math.min(5, level - 1);
      state.invaders.slice(0, existingDivers).forEach((invader) => {
        Object.assign(invader, { diving: true, velocityX: 0, velocityY: 0 });
      });
      state.diveTimer = 0;
      state.enemyShotTimer = 10;

      stepGame(state, 0, idleInput, () => 0);

      const expectedDivers = Math.min(5, level);
      expect(state.invaders.filter((invader) => invader.diving)).toHaveLength(expectedDivers);
    }
  });

  it('allows a diving invader to be shot for double its row score', () => {
    const state = startNewGame();
    const diver = state.invaders[0];
    Object.assign(diver, {
      diving: true,
      velocityX: 0,
      velocityY: 0,
    });
    state.bullets.player = [{
      id: 'dive-shot',
      x: diver.x,
      y: diver.y,
      width: diver.width,
      height: diver.height,
    }];
    state.diveTimer = 10;
    state.enemyShotTimer = 10;

    stepGame(state, 0, idleInput);

    expect(state.invaders.some((invader) => invader.id === diver.id)).toBe(false);
    expect(state.score).toBe(SCORING.byRow[diver.row] * SCORING.divingMultiplier);
  });

  it('loses one ship when a diving invader crashes into the player', () => {
    const state = startNewGame();
    const diver = state.invaders[0];
    Object.assign(diver, {
      diving: true,
      velocityX: 0,
      velocityY: 0,
      x: state.player.x,
      y: state.player.y,
    });
    state.diveTimer = 10;
    state.enemyShotTimer = 10;

    stepGame(state, 0, idleInput);

    expect(state.lives).toBe(PLAYER.startingLives - 1);
    expect(state.invaders.some((invader) => invader.id === diver.id)).toBe(false);
    expect(state.invulnerabilityTimer).toBe(PLAYER.invulnerabilitySeconds);
  });

  it('removes a missed diver without ending the game', () => {
    const state = startNewGame();
    const diver = state.invaders[0];
    Object.assign(diver, {
      diving: true,
      velocityX: 0,
      velocityY: 0,
      y: WORLD.height + 1,
    });
    state.diveTimer = 10;
    state.enemyShotTimer = 10;

    stepGame(state, 0, idleInput);

    expect(state.mode).toBe('running');
    expect(state.lives).toBe(PLAYER.startingLives);
    expect(state.invaders.some((invader) => invader.id === diver.id)).toBe(false);
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
