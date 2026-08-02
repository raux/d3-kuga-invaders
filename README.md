# Signal Invaders

An original Space Invaders-style browser game built with **JavaScript, D3.js, and SVG**. D3 data joins keep the SVG scene synchronized with game state while a `requestAnimationFrame` loop handles simulation.

## Features

- Responsive, resolution-independent SVG playfield
- Keyboard and touch controls
- Five-row enemy formation with edge reversal and descent
- Player and enemy projectiles with collision detection
- Score, persistent high score, lives, levels, pause, and restart
- Increasing speed and firing pressure across endless waves
- Deterministic game-logic tests with Vitest
- Vite development and production builds
- GitHub Actions continuous integration

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

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | `A`/`D` or `←`/`→` | Left/right buttons |
| Fire | `Space` | Fire button |
| Pause/resume | `P` or `Escape` | Pause button |

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
- `src/game/update.js` — simulation and game rules
- `src/game/collision.js` — geometry helpers
- `src/game/input.js` — keyboard/touch input abstraction
- `src/game/renderer.js` — D3/SVG scene renderer
- `src/game/config.js` — balancing constants
- `tests/` — deterministic unit tests

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for design details and extension points.

## Design principles

1. **Original visuals:** all ships and invaders are generated from SVG primitives; no sprite or sound assets are copied.
2. **Simulation/rendering separation:** the renderer displays state but does not decide game outcomes.
3. **Stable data joins:** every projectile and invader receives a persistent key.
4. **Bounded frame time:** long frames are clamped to avoid tunneling and sudden movement.
5. **Progressive enhancement:** keyboard play is primary, with responsive touch controls for coarse pointers.

## Roadmap

- Destructible defense barriers
- Optional Web Audio sound effects
- UFO bonus encounters
- Configurable difficulty and reduced-flashing mode
- End-to-end browser tests
- GitHub Pages deployment workflow

## Inspiration and licensing

The project was inspired by [joshberc/SpaceInvaders](https://github.com/joshberc/SpaceInvaders), a MonoGame/C# project licensed under MIT. Its credited sprites and sounds use CC BY 4.0.

This implementation is written independently for the browser. It does **not** copy the reference project's code, sprites, or audio. Signal Invaders uses original SVG primitives and contains no third-party game assets.

Signal Invaders is available under the [MIT License](LICENSE).
