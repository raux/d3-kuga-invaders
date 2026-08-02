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

  svg
    .append('g')
    .attr('class', 'stars')
    .selectAll('circle')
    .data(buildStars())
    .join('circle')
    .attr('cx', (star) => star.x)
    .attr('cy', (star) => star.y)
    .attr('r', (star) => star.radius)
    .attr('opacity', (star) => star.opacity);

  svg
    .append('line')
    .attr('class', 'defense-line')
    .attr('x1', 28)
    .attr('x2', WORLD.width - 28)
    .attr('y1', 614)
    .attr('y2', 614);

  const invaderLayer = svg.append('g').attr('class', 'invader-layer');
  const bulletLayer = svg.append('g').attr('class', 'bullet-layer');
  const playerLayer = svg.append('g').attr('class', 'player-layer');

  const player = playerLayer.append('g').attr('class', 'player-ship');
  player
    .append('path')
    .attr('d', 'M2,26 L2,13 L16,13 L22,3 L34,3 L40,13 L54,13 L54,26 Z');
  player.append('rect').attr('class', 'player-core').attr('x', 23).attr('y', 8).attr('width', 10).attr('height', 10);

  function renderInvaders(state) {
    const invaders = invaderLayer
      .selectAll('g.invader')
      .data(state.invaders, (invader) => invader.id)
      .join(
        (enter) => {
          const group = enter.append('g').attr('class', (invader) => `invader invader-row-${invader.row}`);
          group.append('path').attr('class', 'invader-antennae').attr('d', 'M9,7 L4,1 M31,7 L36,1');
          group.append('rect').attr('class', 'invader-shell').attr('x', 3).attr('y', 7).attr('width', 34).attr('height', 17).attr('rx', 5);
          group.append('rect').attr('class', 'invader-crown').attr('x', 10).attr('y', 3).attr('width', 20).attr('height', 8).attr('rx', 4);
          group.append('circle').attr('class', 'invader-eye').attr('cx', 13).attr('cy', 15).attr('r', 2.4);
          group.append('circle').attr('class', 'invader-eye').attr('cx', 27).attr('cy', 15).attr('r', 2.4);
          group.append('path').attr('class', 'invader-legs').attr('d', 'M8,23 L5,28 M17,23 L15,28 M23,23 L25,28 M32,23 L35,28');
          return group;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    invaders.attr('transform', (invader) => `translate(${invader.x}, ${invader.y})`);
  }

  function renderBullets(state) {
    bulletLayer
      .selectAll('rect.player-bullet')
      .data(state.bullets.player, (bullet) => bullet.id)
      .join('rect')
      .attr('class', 'player-bullet')
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

  function render(state) {
    renderInvaders(state);
    renderBullets(state);

    player
      .attr('transform', `translate(${state.player.x}, ${state.player.y})`)
      .classed('is-invulnerable', state.invulnerabilityTimer > 0)
      .attr(
        'opacity',
        state.invulnerabilityTimer > 0 && Math.floor(state.elapsed * 12) % 2 === 0 ? 0.25 : 1,
      );
  }

  return { render };
}
