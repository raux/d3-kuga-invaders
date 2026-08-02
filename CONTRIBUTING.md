# Contributing

## Development setup

```bash
npm install
npm run dev
```

Before opening a pull request:

```bash
npm test
npm run build
```

## Project boundaries

- Keep game rules independent of D3 and browser DOM APIs.
- Use stable IDs for every entity rendered through a keyed data join.
- Add deterministic tests for changes to scoring, collisions, movement, or progression.
- Prefer original SVG geometry and generated effects over borrowed game assets.
- Document the source and license of any third-party asset before adding it.

## Pull requests

Keep changes focused and describe:

1. The player-visible behavior changed.
2. The state or rendering modules affected.
3. How the behavior was tested.
4. Any accessibility or performance implications.
