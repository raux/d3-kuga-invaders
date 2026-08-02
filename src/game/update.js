import { BULLETS, DIVES, INVADERS, PLAYER, SCORING, WORLD } from './config.js';
import { clamp, intersects } from './collision.js';
import { createInvaderFormation, nextId } from './state.js';

function spawnPlayerBullet(state) {
  state.bullets.player.push({
    id: nextId(state, 'player-shot'),
    x: state.player.x + state.player.width / 2 - BULLETS.playerWidth / 2,
    y: state.player.y - BULLETS.playerHeight,
    width: BULLETS.playerWidth,
    height: BULLETS.playerHeight,
  });
  state.playerShotTimer = PLAYER.shotCooldown;
}

function bottomInvadersByColumn(invaders) {
  const shooters = new Map();

  invaders.forEach((invader) => {
    const current = shooters.get(invader.column);
    if (!current || invader.y > current.y) shooters.set(invader.column, invader);
  });

  return [...shooters.values()];
}

function spawnEnemyBullet(state, random) {
  const formationInvaders = state.invaders.filter((invader) => !invader.diving);
  const shooters = bottomInvadersByColumn(formationInvaders);
  if (!shooters.length) return;

  const index = Math.min(shooters.length - 1, Math.floor(random() * shooters.length));
  const shooter = shooters[index];

  state.bullets.enemy.push({
    id: nextId(state, 'enemy-shot'),
    x: shooter.x + shooter.width / 2 - BULLETS.enemyWidth / 2,
    y: shooter.y + shooter.height,
    width: BULLETS.enemyWidth,
    height: BULLETS.enemyHeight,
  });

  const pressure = 1 - state.invaders.length / (INVADERS.rows * INVADERS.columns);
  state.enemyShotTimer = Math.max(0.34, 1.2 - state.level * 0.06 - pressure * 0.35);
}

function scheduleNextDive(state, random) {
  const reduction = (state.level - 1) * DIVES.intervalLevelReduction;
  const minimum = Math.max(0.9, DIVES.minInterval - reduction);
  const maximum = Math.max(minimum, DIVES.maxInterval - reduction);
  state.diveTimer = minimum + random() * (maximum - minimum);
}

function launchDiver(state, random) {
  const formationInvaders = state.invaders.filter((invader) => !invader.diving);
  const activeDivers = state.invaders.length - formationInvaders.length;
  const levelLimit = 1 + Math.floor((state.level - 1) / DIVES.levelsPerExtraDiver);
  const activeLimit = Math.min(DIVES.maxActive, levelLimit);

  if (activeDivers >= activeLimit) {
    state.diveTimer = 0.4;
    return;
  }

  const candidates = bottomInvadersByColumn(formationInvaders);
  if (!candidates.length) {
    state.diveTimer = 0.4;
    return;
  }

  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  const diver = candidates[index];
  const verticalSpeed = Math.min(
    DIVES.maxVerticalSpeed,
    DIVES.verticalSpeed + (state.level - 1) * DIVES.speedPerLevel,
  );
  const distanceToPlayer = Math.max(1, state.player.y - diver.y);
  const travelTime = Math.max(0.6, distanceToPlayer / verticalSpeed);
  const targetOffset =
    state.player.x + state.player.width / 2 - (diver.x + diver.width / 2);

  diver.diving = true;
  diver.velocityX = clamp(
    targetOffset / travelTime,
    -DIVES.maxHorizontalSpeed,
    DIVES.maxHorizontalSpeed,
  );
  diver.velocityY = verticalSpeed;
  scheduleNextDive(state, random);
}

function moveFormation(state, dt) {
  const formationInvaders = state.invaders.filter((invader) => !invader.diving);
  if (!formationInvaders.length) return;

  const clearedRatio = 1 - state.invaders.length / (INVADERS.rows * INVADERS.columns);
  const speed = state.formation.speed * (1 + clearedRatio * 1.15);
  const dx = state.formation.direction * speed * dt;
  const left = Math.min(...formationInvaders.map((invader) => invader.x));
  const right = Math.max(...formationInvaders.map((invader) => invader.x + invader.width));
  const hitsEdge =
    left + dx < WORLD.padding || right + dx > WORLD.width - WORLD.padding;

  if (hitsEdge) {
    state.formation.direction *= -1;
    formationInvaders.forEach((invader) => {
      invader.y += INVADERS.dropDistance;
    });
  } else {
    formationInvaders.forEach((invader) => {
      invader.x += dx;
    });
  }
}

function moveDivingInvaders(state, dt) {
  state.invaders
    .filter((invader) => invader.diving)
    .forEach((invader) => {
      invader.x += invader.velocityX * dt;
      invader.y += invader.velocityY * dt;
    });
}

function moveBullets(state, dt) {
  state.bullets.player.forEach((bullet) => {
    bullet.y -= BULLETS.playerSpeed * dt;
  });
  state.bullets.enemy.forEach((bullet) => {
    bullet.y += BULLETS.enemySpeed * dt;
  });

  state.bullets.player = state.bullets.player.filter(
    (bullet) => bullet.y + bullet.height >= 0,
  );
  state.bullets.enemy = state.bullets.enemy.filter(
    (bullet) => bullet.y <= WORLD.height,
  );
}

function resolvePlayerShots(state) {
  const destroyedInvaders = new Set();
  const spentBullets = new Set();

  for (const bullet of state.bullets.player) {
    const target = state.invaders.find(
      (invader) => !destroyedInvaders.has(invader.id) && intersects(bullet, invader),
    );

    if (target) {
      destroyedInvaders.add(target.id);
      spentBullets.add(bullet.id);
      const baseValue = SCORING.byRow[target.row] ?? 10;
      state.score += baseValue * (target.diving ? SCORING.divingMultiplier : 1);
    }
  }

  state.invaders = state.invaders.filter((invader) => !destroyedInvaders.has(invader.id));
  state.bullets.player = state.bullets.player.filter(
    (bullet) => !spentBullets.has(bullet.id),
  );
}

function damagePlayer(state) {
  state.lives -= 1;

  if (state.lives <= 0) {
    state.mode = 'gameover';
    return;
  }

  state.player.x = (WORLD.width - PLAYER.width) / 2;
  state.invulnerabilityTimer = PLAYER.invulnerabilitySeconds;
}

function resolveEnemyShots(state) {
  if (state.invulnerabilityTimer > 0) return;

  const hit = state.bullets.enemy.find((bullet) => intersects(bullet, state.player));
  if (!hit) return;

  state.bullets.enemy = state.bullets.enemy.filter((bullet) => bullet.id !== hit.id);
  damagePlayer(state);
}

function resolveDivingInvaders(state) {
  const hit = state.invaders.find(
    (invader) => invader.diving && intersects(invader, state.player),
  );
  if (!hit) return;

  state.invaders = state.invaders.filter((invader) => invader.id !== hit.id);
  if (state.invulnerabilityTimer <= 0) damagePlayer(state);
}

function removeMissedDivers(state) {
  state.invaders = state.invaders.filter(
    (invader) => !invader.diving || invader.y <= WORLD.height,
  );
}

function advanceLevel(state) {
  state.score += SCORING.levelClear;
  state.level += 1;
  state.invaders = createInvaderFormation(state.level);
  state.bullets.player = [];
  state.bullets.enemy = [];
  state.formation.direction = 1;
  state.formation.speed = INVADERS.baseSpeed + INVADERS.speedPerLevel * (state.level - 1);
  state.enemyShotTimer = 1;
  state.diveTimer = Math.max(
    1.5,
    DIVES.initialDelay - (state.level - 1) * DIVES.intervalLevelReduction,
  );
}

function finishIfInvadersLanded(state) {
  if (state.invaders.some(
    (invader) => !invader.diving && invader.y + invader.height >= INVADERS.floorY,
  )) {
    state.lives = 0;
    state.mode = 'gameover';
  }
}

export function stepGame(state, deltaSeconds, input, random = Math.random) {
  if (state.mode !== 'running') return state;

  const dt = clamp(deltaSeconds, 0, 0.05);
  state.elapsed += dt;
  state.playerShotTimer = Math.max(0, state.playerShotTimer - dt);
  state.enemyShotTimer -= dt;
  state.diveTimer -= dt;
  state.invulnerabilityTimer = Math.max(0, state.invulnerabilityTimer - dt);

  if (Number.isFinite(input.targetX)) {
    state.player.x = clamp(
      input.targetX - state.player.width / 2,
      WORLD.padding,
      WORLD.width - WORLD.padding - state.player.width,
    );
  } else {
    const movement = Number(Boolean(input.right)) - Number(Boolean(input.left));
    state.player.x = clamp(
      state.player.x + movement * PLAYER.speed * dt,
      WORLD.padding,
      WORLD.width - WORLD.padding - state.player.width,
    );
  }

  if (input.fire && state.playerShotTimer <= 0) spawnPlayerBullet(state);
  if (state.diveTimer <= 0) launchDiver(state, random);

  moveFormation(state, dt);
  moveDivingInvaders(state, dt);
  moveBullets(state, dt);
  resolvePlayerShots(state);
  resolveEnemyShots(state);
  resolveDivingInvaders(state);
  removeMissedDivers(state);
  finishIfInvadersLanded(state);

  if (state.mode === 'running' && state.enemyShotTimer <= 0) {
    spawnEnemyBullet(state, random);
  }

  if (state.mode === 'running' && state.invaders.length === 0) advanceLevel(state);

  state.highScore = Math.max(state.highScore, state.score);
  return state;
}
