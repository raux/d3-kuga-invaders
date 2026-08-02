import { BULLETS, DIVES, FEEDBACK, INVADERS, PLAYER, SCORING, WORLD } from './config.js';
import { clamp, intersects } from './collision.js';
import { createInvaderFormation, nextId } from './state.js';

function emitEvent(state, type, detail = {}) {
  state.events.push({ type, ...detail });
}

function triggerShake(state, seconds, strength) {
  state.screenShake.remaining = Math.max(state.screenShake.remaining, seconds);
  state.screenShake.strength = Math.max(state.screenShake.strength, strength);
}

function spawnParticles(state, x, y, count, kind) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + state.elapsed * 0.7;
    const speed = 72 + (index % 4) * 28;
    state.particles.push({
      id: nextId(state, 'particle'),
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 18,
      radius: 2 + (index % 3),
      kind,
      remaining: FEEDBACK.particleSeconds,
      duration: FEEDBACK.particleSeconds,
    });
  }
}

function spawnPlayerBullet(state) {
  state.bullets.player.push({
    id: nextId(state, 'player-shot'),
    x: state.player.x + state.player.width / 2 - BULLETS.playerWidth / 2,
    y: state.player.y - BULLETS.playerHeight,
    width: BULLETS.playerWidth,
    height: BULLETS.playerHeight,
  });
  state.playerShotTimer = PLAYER.shotCooldown;
  emitEvent(state, 'shot-fired', {
    x: state.player.x + state.player.width / 2,
    y: state.player.y,
  });
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
  const eliteChance = state.level < DIVES.eliteMinimumLevel
    ? 0
    : Math.min(
      DIVES.eliteMaxChance,
      DIVES.eliteBaseChance + (state.level - DIVES.eliteMinimumLevel) * DIVES.eliteChancePerLevel,
    );
  const isElite = random() < eliteChance;
  const baseVerticalSpeed = Math.min(
    DIVES.maxVerticalSpeed,
    DIVES.verticalSpeed + (state.level - 1) * DIVES.speedPerLevel,
  );
  const verticalSpeed = baseVerticalSpeed * (isElite ? DIVES.eliteVerticalSpeedMultiplier : 1);
  const maxHorizontalSpeed = DIVES.maxHorizontalSpeed
    * (isElite ? DIVES.eliteHorizontalSpeedMultiplier : 1);
  const distanceToPlayer = Math.max(1, state.player.y - diver.y);
  const travelTime = Math.max(0.6, distanceToPlayer / verticalSpeed);
  const targetOffset =
    state.player.x + state.player.width / 2 - (diver.x + diver.width / 2);

  diver.diving = true;
  diver.diveType = isElite ? 'elite' : 'standard';
  diver.velocityX = clamp(targetOffset / travelTime, -maxHorizontalSpeed, maxHorizontalSpeed);
  diver.velocityY = verticalSpeed;
  if (isElite) emitEvent(state, 'elite-diver-launched');
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

function resetCombo(state) {
  state.combo.hits = 0;
  state.combo.multiplier = 1;
}

function moveBullets(state, dt) {
  state.bullets.player.forEach((bullet) => {
    bullet.y -= BULLETS.playerSpeed * dt;
  });
  state.bullets.enemy.forEach((bullet) => {
    bullet.y += BULLETS.enemySpeed * dt;
  });

  const missedShot = state.bullets.player.some((bullet) => bullet.y + bullet.height < 0);
  state.bullets.player = state.bullets.player.filter(
    (bullet) => bullet.y + bullet.height >= 0,
  );
  state.bullets.enemy = state.bullets.enemy.filter(
    (bullet) => bullet.y <= WORLD.height,
  );
  if (missedShot) resetCombo(state);
}

function moveScorePopups(state, dt) {
  state.scorePopups.forEach((popup) => {
    popup.y -= FEEDBACK.scorePopupRiseSpeed * dt;
    popup.remaining -= dt;
  });
  state.scorePopups = state.scorePopups.filter((popup) => popup.remaining > 0);
}

function moveParticles(state, dt) {
  const drag = Math.pow(FEEDBACK.particleDrag, dt * 60);
  state.particles.forEach((particle) => {
    particle.velocityX *= drag;
    particle.velocityY = particle.velocityY * drag + FEEDBACK.particleGravity * dt;
    particle.x += particle.velocityX * dt;
    particle.y += particle.velocityY * dt;
    particle.remaining -= dt;
  });
  state.particles = state.particles.filter((particle) => particle.remaining > 0);
  state.screenShake.remaining = Math.max(0, state.screenShake.remaining - dt);
  if (state.screenShake.remaining === 0) state.screenShake.strength = 0;
}

function awardInvaderHit(state, target) {
  const previousMultiplier = state.combo.multiplier;
  state.combo.hits += 1;
  state.combo.multiplier = Math.min(
    SCORING.maxComboMultiplier,
    1 + Math.floor(state.combo.hits / SCORING.comboHitsPerStep),
  );

  const baseValue = SCORING.byRow[target.row] ?? 10;
  const diveMultiplier = target.diveType === 'elite'
    ? SCORING.eliteDivingMultiplier
    : target.diving ? SCORING.divingMultiplier : 1;
  const awarded = baseValue * diveMultiplier * state.combo.multiplier;
  state.score += awarded;
  const centerX = target.x + target.width / 2;
  const centerY = target.y + target.height / 2;
  state.scorePopups.push({
    id: nextId(state, 'score-popup'),
    x: centerX,
    y: target.y,
    value: awarded,
    comboMultiplier: state.combo.multiplier,
    remaining: FEEDBACK.scorePopupSeconds,
    duration: FEEDBACK.scorePopupSeconds,
  });

  const isElite = target.diveType === 'elite';
  spawnParticles(
    state,
    centerX,
    centerY,
    isElite ? FEEDBACK.explosionParticleCount + 6 : FEEDBACK.explosionParticleCount,
    isElite ? 'elite' : `row-${target.row}`,
  );
  triggerShake(
    state,
    isElite ? FEEDBACK.eliteShakeSeconds : FEEDBACK.hitShakeSeconds,
    isElite ? FEEDBACK.eliteShakeStrength : FEEDBACK.hitShakeStrength,
  );
  emitEvent(state, 'enemy-destroyed', {
    elite: isElite,
    value: awarded,
    comboMultiplier: state.combo.multiplier,
  });
  if (state.combo.multiplier > previousMultiplier) {
    emitEvent(state, 'combo-increased', { multiplier: state.combo.multiplier });
  }
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
      awardInvaderHit(state, target);
    }
  }

  state.invaders = state.invaders.filter((invader) => !destroyedInvaders.has(invader.id));
  state.bullets.player = state.bullets.player.filter(
    (bullet) => !spentBullets.has(bullet.id),
  );
}

function damagePlayer(state) {
  state.lives -= 1;
  resetCombo(state);
  spawnParticles(
    state,
    state.player.x + state.player.width / 2,
    state.player.y + state.player.height / 2,
    FEEDBACK.playerHitParticleCount,
    'player-hit',
  );
  triggerShake(state, FEEDBACK.playerShakeSeconds, FEEDBACK.playerShakeStrength);
  emitEvent(state, 'player-hit', { lives: state.lives });

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
  resetCombo(state);
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
  emitEvent(state, 'wave-started', { level: state.level });
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
  state.events = [];
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
  moveScorePopups(state, dt);
  moveParticles(state, dt);
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
