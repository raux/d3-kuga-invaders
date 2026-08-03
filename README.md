# Kuga Invaders

An original Space Invaders-style browser game built with **JavaScript, D3.js, and SVG**. D3 data joins keep the SVG scene synchronized with game state while a `requestAnimationFrame` loop handles simulation.

## Features

- Responsive, resolution-independent SVG playfield
- Keyboard, two-axis touchscreen joystick, bounded vertical movement, and horizontal finger-drag controls
- Five-row anime-inspired enemy formation with expressive eyes, blinking, body motion, and dive animation
- Standard ×2 and faster elite ×5 divers, including double dives from level 3 and triple dives from level 6
- Player and enemy projectiles with collision detection
- Fifteen timed Overdrive stacks that increase score, fire rate, bullet speed, size, and visual power
- Score, persistent high score, lives, levels, pause, restart, and return-to-title controls
- Increasing speed and firing pressure across endless waves
- Synthesized Web Audio with row-specific enemy voices, layered explosions, enemy fire, descending dive drops, and wave cues
- Stack-scaled explosions, shockwaves, tier announcements, screen shake, and weapon colors
- Auto-fire controls for desktop and mobile, plus lower-playfield drag controls for mobile
- Deterministic game-logic tests with Vitest
- Installable PWA with home-screen icons and offline shell caching
- Vite development and production builds
- GitHub Actions continuous integration and Pages deployment

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

```bash
npm test        # run game-logic tests
npm run build   # create the production build in dist/
npm run preview # preview the build
```

## Install on mobile

Open [Kuga Invaders](https://raux.github.io/d3-kuga-invaders/) in Safari or Chrome, then choose **Add to Home Screen** or **Install app**. The installed game launches in a standalone window and keeps its application shell available offline after the first successful visit.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `W`/`A`/`S`/`D` or arrow keys | Use the two-axis joystick; drag the lower playfield for horizontal movement |
| Fire | `Space` or the Auto Fire button | Fire button or Auto toggle |
| Pause/resume | `P` or `Escape` | Pause button |

## Scoring

Enemy values from the top row to the bottom row are **50, 40, 30, 20, and 10 points**. Standard divers score **×2** and faster elite divers score **×5**. Each kill adds an Overdrive stack and refreshes a 2.2-second grace timer. Every three stacks raises the score and weapon tier, capped at 15 stacks and ×5. Stacks decay gradually after the timer expires, player damage breaks the chain, and half the stacks carry into the next wave. Clearing a wave awards an additional 250 points.

## How D3 is used

D3 owns the SVG scene graph. Every rendered entity has a stable ID and is bound to an SVG element through keyed joins:

```js
layer
  .selectAll('g.invader')
  .data(state.invaders, (invader) => invader.id)
  .join(enter, update, exit);
```

D3 is deliberately kept out of game rules. Movement, collision detection, scoring, and wave progression live in plain JavaScript modules that can be tested without a browser.

## Architecture

```text
Keyboard / touch
       │
       ▼
  input snapshot ──► stepGame(state, dt) ──► game state
                                                │
                                                ▼
                                     D3 keyed SVG renderer
```

- `src/main.js` — application lifecycle and animation loop
- `src/game/state.js` — state factories and entity identity
- `src/game/combo.js` — derived Overdrive tiers and weapon modifiers
- `src/game/update.js` — simulation and game rules
- `src/game/collision.js` — geometry helpers
- `src/game/input.js` — keyboard input abstraction
- `src/game/touch-controls.js` — two-axis joystick, diagonal input, pointer capture, dead-zone handling, and simultaneous touch actions
- `src/game/audio.js` — original synthesized Web Audio feedback
- `src/game/haptics.js` — optional mobile vibration patterns
- `src/game/renderer.js` — D3/SVG scene renderer and transient visual effects
- `src/game/config.js` — balancing constants
- `tests/` — deterministic unit tests

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for design details and extension points.

## Design principles

1. **Original visuals:** all ships and anime-inspired invaders are generated from animated SVG primitives; no sprite or sound assets are copied.
2. **Simulation/rendering separation:** the renderer displays state but does not decide game outcomes.
3. **Stable data joins:** every projectile and invader receives a persistent key.
4. **Bounded frame time:** long frames are clamped to avoid tunneling and sudden movement.
5. **Progressive enhancement:** keyboard play is primary, with responsive touch controls for coarse pointers.

## Roadmap

- Destructible defense barriers
- Power-up drops and temporary weapon effects
- Kuga Mothership boss waves
- Zig-zag and coordinated swarm formations
- UFO bonus encounters
- End-to-end browser tests

## Inspiration and licensing

The project was inspired by [joshberc/SpaceInvaders](https://github.com/joshberc/SpaceInvaders), a MonoGame/C# project licensed under MIT. Its credited sprites and sounds use CC BY 4.0.

This implementation is written independently for the browser. It does **not** copy the reference project's code, sprites, or audio. Kuga Invaders uses original SVG primitives and contains no third-party game assets.

Kuga Invaders is available under the [MIT License](LICENSE).
