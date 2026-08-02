# Architecture

## Goal

Kuga Invaders demonstrates that D3.js can render a real-time interactive SVG game while conventional JavaScript modules retain ownership of simulation and rules.

## Runtime pipeline

Each animation frame follows one direction of data flow:

1. `input.js` records held controls and one-shot commands.
2. `main.js` calculates elapsed time and provides an input snapshot.
3. `update.js` advances the mutable state by a bounded time step.
4. `renderer.js` reconciles state with SVG through keyed D3 joins.
5. `audio.js` and `haptics.js` consume transient simulation events.
6. `main.js` synchronizes the HTML HUD and saves changed scores and preferences.

The renderer never writes to game state. This boundary keeps core rules runnable under Node.js and prevents SVG transitions from becoming a second source of truth.

## State model

The top-level state contains:

- Session: `mode`, `score`, `highScore`, `lives`, `level`, and elapsed time
- Overdrive: timed stacks, current tier, decay phase, and derived weapon modifiers
- Timers: player cooldown, enemy firing, dive scheduling, and player invulnerability
- Formation: horizontal direction and level-dependent base speed
- Entities: player, formation/diving invaders, two projectile collections, particles, and score popups
- Feedback: a per-frame event queue and bounded screen-shake state
- Identity: a monotonic counter for dynamically created entities

Invader IDs derive from level, row, and column. Their row determines a distinct base score, while destroying a diving invader applies a score multiplier. Projectile IDs derive from the session counter. Stable IDs ensure D3 updates the intended SVG node rather than matching by array position.

## Simulation

`stepGame(state, deltaSeconds, input, random)` is the main simulation entry point. The optional random function makes enemy-shot and dive selection controllable in tests.

The update order is intentional:

1. Clamp the frame delta and update timers.
2. Move and constrain the player.
3. Spawn eligible player projectiles and dive attacks.
4. Move the formation, diving invaders, and projectiles.
5. Resolve projectile, diving-enemy, and player collisions.
6. Remove missed divers and detect a landed formation.
7. Spawn an enemy projectile when its timer expires.
8. Advance a cleared level.
9. Recalculate the high score.

The maximum simulated frame is 50 ms. A future physics-heavy version should replace this clamp with a fixed-timestep accumulator.

## Rendering

The SVG uses a `960 × 640` logical coordinate system and scales through `viewBox`. Entity geometry therefore remains in one predictable world coordinate system at every display size.

Static layers (stars and defense line) are constructed once. Dynamic layers use D3 joins:

- Invaders: keyed nested `<g>` elements composed from original SVG primitives, with independently animated eyes, pupils, bodies, antennae, legs, speed lines, and elite auras
- Projectiles: keyed `<rect>` elements
- Particles, expanding shockwaves, tier announcements, and score popups: short-lived keyed visual feedback
- Player: one persistent `<g>` with transform, thrust, and visibility updates

No external sprite sheets are required.

## Accessibility and input

The playfield has an accessible label, while game status is represented in HTML around the SVG. Buttons have explicit labels, pressed states, large touch targets, and visible focus states. Keyboard controls prevent scrolling only for keys used during play. Touch controls appear on small or coarse-pointer devices. The two-axis joystick supports diagonal movement, independent horizontal and vertical dead zones, pointer capture, keyboard focus, directional announcements, and a visible center-return state. Vertical movement is intentionally constrained to a narrow defense band; lower-playfield dragging remains horizontal so it does not conflict with aiming. Auto-fire, synthesized sound, and haptics are independently toggleable, and reduced-motion preferences disable shake and transient particle animation.

A dedicated polite live region announces mode changes without wrapping the frequently updated score HUD. The SVG describes the game at a high level rather than announcing every moving entity, because continuous frame-by-frame updates would overwhelm assistive technology. Responsive styles account for dynamic viewport height, device safe areas, portrait mode, and short landscape screens.

## Progressive web app

The production build registers `public/sw.js` under Vite's configured base path. The service worker uses network-first navigation and caches the application shell plus fetched same-origin assets. `public/manifest.webmanifest` provides standalone display metadata and install icons for mobile home screens.

## Extension points

### Barriers

Add `barriers` to state as collections of cells. Resolve projectile-to-cell collisions before projectile-to-ship collisions, then render cells with one keyed join.

### Feedback events

The simulation emits short-lived events such as `shot-fired`, `enemy-shot-fired`, `dive-group-launched`, `enemy-destroyed`, `combo-stack-added`, `combo-tier-increased`, and `player-hit`. Audio and haptic controllers consume them after each update without detecting state differences in the renderer. Future achievements and statistics can subscribe to the same event vocabulary.

### Fixed timestep

Introduce an accumulator in `main.js`, call `stepGame` in 8–16 ms increments, and render once after all updates. This improves collision consistency on slow devices.

### Alternate renderers

Because rules do not import D3, a Canvas or WebGL renderer can consume the same state model. Renderer parity tests can validate entity counts and transforms.

## Testing strategy

Unit tests cover state creation, horizontal and vertical world bounds, two-axis joystick diagonals, cooldown behavior, Overdrive decay and weapon scaling, elite-diver scoring, formation reversal, level progression, touch regions, row-specific explosion recipes, enemy-shot and dive audio events, haptic patterns, and loss conditions. Recommended next layers are:

- Property tests for collision symmetry and world bounds
- Browser tests for keyboard/touch interaction
- Visual regression snapshots for the SVG scene
- Long-running simulation tests with seeded randomness
