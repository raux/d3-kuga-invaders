import * as d3 from 'd3';
import { WORLD } from './config.js';

function buildStars() {
  return d3.range(95).map((index) => ({
    id: index,
    x: (index * 83 + 19) % WORLD.width,
    y: (index * 137 + 31) % WORLD.height,
    radius: 0.6 + ((index * 7) % 15) / 10,
    opacity: 0.2 + ((index * 11) % 55) / 100,
  }));
}

export function createRenderer(svgElement) {
  const svg = d3
    .select(svgElement)
    .attr('viewBox', `0 0 ${WORLD.width} ${WORLD.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const defs = svg.append('defs');
  const glow = defs.append('filter').attr('id', 'soft-glow');
  glow.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'blur');
  const merge = glow.append('feMerge');
  merge.append('feMergeNode').attr('in', 'blur');
  merge.append('feMergeNode').attr('in', 'SourceGraphic');

  const scene = svg.append('g').attr('class', 'game-scene');
  const reducedMotionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  scene
    .append('g')
    .attr('class', 'stars')
    .selectAll('circle')
    .data(buildStars())
    .join('circle')
    .attr('cx', (star) => star.x)
    .attr('cy', (star) => star.y)
    .attr('r', (star) => star.radius)
    .attr('opacity', (star) => star.opacity);

  scene
    .append('line')
    .attr('class', 'defense-line')
    .attr('x1', 28)
    .attr('x2', WORLD.width - 28)
    .attr('y1', 614)
    .attr('y2', 614);

  const invaderLayer = scene.append('g').attr('class', 'invader-layer');
  const bulletLayer = scene.append('g').attr('class', 'bullet-layer');
  const particleLayer = scene.append('g').attr('class', 'particle-layer');
  const shockwaveLayer = scene.append('g').attr('class', 'shockwave-layer');
  const playerLayer = scene.append('g').attr('class', 'player-layer');
  const popupLayer = scene.append('g').attr('class', 'score-popup-layer');
  const announcementLayer = scene.append('g').attr('class', 'announcement-layer');

  const player = playerLayer.append('g').attr('class', 'player-ship');
  player
    .append('path')
    .attr('class', 'player-thruster')
    .attr('d', 'M17,25 L22,39 L28,27 L34,39 L39,25 Z');
  player
    .append('path')
    .attr('class', 'player-hull')
    .attr('d', 'M2,26 L2,13 L16,13 L22,3 L34,3 L40,13 L54,13 L54,26 Z');
  player.append('rect').attr('class', 'player-core').attr('x', 23).attr('y', 8).attr('width', 10).attr('height', 10);

  function renderInvaders(state) {
    const invaders = invaderLayer
      .selectAll('g.invader')
      .data(state.invaders, (invader) => invader.id)
      .join(
        (enter) => {
          const group = enter
            .append('g')
            .attr('class', (invader) => `invader invader-row-${invader.row}`);
          const motion = group.append('g').attr('class', 'invader-motion');

          motion
            .append('ellipse')
            .attr('class', 'invader-aura')
            .attr('cx', 20)
            .attr('cy', 15)
            .attr('rx', 24)
            .attr('ry', 20);
          motion
            .append('path')
            .attr('class', 'invader-speed-lines')
            .attr('d', 'M4,-5 L4,-14 M13,-3 L11,-16 M27,-3 L29,-16 M36,-5 L36,-14');
          motion
            .append('path')
            .attr('class', 'invader-antennae')
            .attr('d', 'M10,8 Q7,3 3,1 M30,8 Q33,3 37,1');
          motion
            .append('rect')
            .attr('class', 'invader-shell')
            .attr('x', 1)
            .attr('y', 7)
            .attr('width', 38)
            .attr('height', 19)
            .attr('rx', 8);
          motion
            .append('path')
            .attr('class', 'invader-crown')
            .attr('d', 'M6,10 Q10,1 16,6 Q20,-1 24,6 Q30,1 34,10 Z');
          motion
            .append('path')
            .attr('class', 'invader-shell-shine')
            .attr('d', 'M6,11 Q10,8 15,9');

          for (const eye of [
            { side: 'left', x: 12.5 },
            { side: 'right', x: 27.5 },
          ]) {
            const eyeGroup = motion.append('g').attr('class', `invader-eye invader-eye-${eye.side}`);
            eyeGroup
              .append('ellipse')
              .attr('class', 'invader-eye-white')
              .attr('cx', eye.x)
              .attr('cy', 15.5)
              .attr('rx', 5.4)
              .attr('ry', 4.8);
            eyeGroup
              .append('circle')
              .attr('class', 'invader-iris')
              .attr('cx', eye.x)
              .attr('cy', 16)
              .attr('r', 3.3);
            eyeGroup
              .append('circle')
              .attr('class', 'invader-pupil')
              .attr('cx', eye.x)
              .attr('cy', 16.2)
              .attr('r', 1.75);
            eyeGroup
              .append('circle')
              .attr('class', 'invader-eye-highlight')
              .attr('cx', eye.x - 1.15)
              .attr('cy', 14.7)
              .attr('r', 1.05);
          }

          motion.append('path').attr('class', 'invader-brow').attr('d', 'M7,11 L16,9 M24,9 L33,11');
          motion.append('path').attr('class', 'invader-mouth invader-mouth-idle').attr('d', 'M17,21 Q20,23.5 23,21');
          motion.append('path').attr('class', 'invader-mouth invader-mouth-dive').attr('d', 'M16,23 Q20,18.5 24,23');
          motion.append('path').attr('class', 'invader-cheeks').attr('d', 'M5,20 L8,19 M32,19 L35,20');
          motion.append('path').attr('class', 'invader-legs').attr('d', 'M7,24 L4,29 M15,24 L14,29 M25,24 L26,29 M33,24 L36,29');
          return group;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    invaders
      .classed('is-diving', (invader) => Boolean(invader.diving))
      .classed('is-elite-diver', (invader) => invader.diveType === 'elite')
      .style('--anime-delay', (invader) => `${-((invader.row * 10 + invader.column) * 83 % 1900)}ms`)
      .style('--anime-speed', (invader) => `${1.05 + ((invader.row + invader.column) % 5) * 0.08}s`)
      .attr('transform', (invader) => {
        if (!invader.diving) return `translate(${invader.x}, ${invader.y})`;

        const angle = Math.max(-28, Math.min(28, invader.velocityX * 0.14));
        const centerX = invader.x + invader.width / 2;
        const centerY = invader.y + invader.height / 2;
        return `translate(${centerX}, ${centerY}) rotate(${angle}) translate(${-invader.width / 2}, ${-invader.height / 2})`;
      });
  }

  function renderBullets(state) {
    bulletLayer
      .selectAll('rect.player-bullet')
      .data(state.bullets.player, (bullet) => bullet.id)
      .join('rect')
      .attr('class', (bullet) => `player-bullet combo-tier-${bullet.comboTier || 0}`)
      .attr('x', (bullet) => bullet.x)
      .attr('y', (bullet) => bullet.y)
      .attr('width', (bullet) => bullet.width)
      .attr('height', (bullet) => bullet.height);

    bulletLayer
      .selectAll('rect.enemy-bullet')
      .data(state.bullets.enemy, (bullet) => bullet.id)
      .join('rect')
      .attr('class', 'enemy-bullet')
      .attr('x', (bullet) => bullet.x)
      .attr('y', (bullet) => bullet.y)
      .attr('width', (bullet) => bullet.width)
      .attr('height', (bullet) => bullet.height);
  }

  function renderParticles(state) {
    particleLayer
      .selectAll('circle.particle')
      .data(state.particles, (particle) => particle.id)
      .join('circle')
      .attr('class', (particle) => `particle particle-${particle.kind}`)
      .attr('cx', (particle) => particle.x)
      .attr('cy', (particle) => particle.y)
      .attr('r', (particle) => particle.radius)
      .attr('opacity', (particle) => Math.min(1, particle.remaining / (particle.duration * 0.45)));
  }

  function renderShockwaves(state) {
    shockwaveLayer
      .selectAll('circle.combo-shockwave')
      .data(state.shockwaves, (shockwave) => shockwave.id)
      .join('circle')
      .attr('class', (shockwave) => `combo-shockwave combo-tier-${shockwave.tier}${shockwave.emphasis ? ' is-tier-up' : ''}`)
      .attr('cx', (shockwave) => shockwave.x)
      .attr('cy', (shockwave) => shockwave.y)
      .attr('r', (shockwave) => {
        const progress = 1 - shockwave.remaining / shockwave.duration;
        return Math.max(2, shockwave.targetRadius * progress);
      })
      .attr('opacity', (shockwave) => Math.max(0, shockwave.remaining / shockwave.duration));
  }

  function renderScorePopups(state) {
    popupLayer
      .selectAll('text.score-popup')
      .data(state.scorePopups, (popup) => popup.id)
      .join('text')
      .attr(
        'class',
        (popup) => `score-popup combo-tier-${popup.tier || 0}${popup.comboMultiplier > 1 ? ' has-combo' : ''}`,
      )
      .attr('x', (popup) => popup.x)
      .attr('y', (popup) => popup.y)
      .attr('opacity', (popup) => Math.min(1, popup.remaining / (popup.duration * 0.35)))
      .text((popup) => `+${popup.value} ×${popup.comboMultiplier}`);
  }

  function renderAnnouncements(state) {
    announcementLayer
      .selectAll('text.tier-announcement')
      .data(state.announcements, (announcement) => announcement.id)
      .join('text')
      .attr('class', (announcement) => `tier-announcement combo-tier-${announcement.tier}`)
      .attr('x', WORLD.width / 2)
      .attr('y', WORLD.height * 0.54)
      .attr('opacity', (announcement) => {
        const life = announcement.remaining / announcement.duration;
        return Math.min(1, life * 3, (1 - life) * 5);
      })
      .text((announcement) => `${announcement.text} ×${announcement.multiplier}`);
  }

  function render(state) {
    renderInvaders(state);
    renderBullets(state);
    renderParticles(state);
    renderShockwaves(state);
    renderScorePopups(state);
    renderAnnouncements(state);

    const shouldShake = state.screenShake.remaining > 0 && !reducedMotionQuery?.matches;
    const shakeX = shouldShake
      ? Math.sin(state.elapsed * 113) * state.screenShake.strength
      : 0;
    const shakeY = shouldShake
      ? Math.cos(state.elapsed * 97) * state.screenShake.strength * 0.55
      : 0;
    scene.attr('transform', `translate(${shakeX}, ${shakeY})`);

    player
      .attr('class', `player-ship combo-tier-${state.combo.tier}`)
      .attr('transform', `translate(${state.player.x}, ${state.player.y})`)
      .classed('is-invulnerable', state.invulnerabilityTimer > 0)
      .attr(
        'opacity',
        state.invulnerabilityTimer > 0 && Math.floor(state.elapsed * 12) % 2 === 0 ? 0.25 : 1,
      );
  }

  return { render };
}
