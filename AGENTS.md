# AGENTS.md

Guidance for agentic coding agents operating in this repository.

## Project overview

A Pac-Man-like game built with **plain Vanilla JS, HTML, and CSS** — no
frameworks, no bundler, no transpiler, no package manager. The project is also
a learning sandbox for **Spec Driven Development** (see the spec workflow
below). UI text and source comments are written in **Spanish**; keep that
language when touching existing files.

## Build / run / test commands

There is **no build step** and **no package.json**. The app runs by opening
`src/index.html` directly in a browser. For local development, serve the
`src/` directory with any static server:

```bash
# Python (no install needed on most systems)
python -m http.server 8000 --directory src
# then open http://localhost:8000

# Node (if available)
npx serve src
```

There is **no test framework, linter, formatter, or type checker** configured.
There is no command to run a single test because there are no automated tests.
Verification is **manual** and, for spec-driven work, defined by each spec's
**Acceptance criteria** checklist (see spec workflow). When you finish a
change, open the game in a browser and confirm the relevant behavior plus the
console is free of errors.

If you later add a linter/formatter or test runner, record the exact commands
here so future agents know to run them.

## Architecture

Scripts are loaded as plain `<script>` tags (no ES modules) in
`src/index.html`, in strict dependency order. Each file exposes its public API
by attaching to `window.*` at the bottom. **Load order matters:**

1. `src/js/maze.js` — maze layout (28x31), parsed to a numeric grid. Exposes
   `window.MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
2. `src/js/game.js` — state and rules (`createGame`, `update`, `DIRS`).
3. `src/js/render.js` — canvas drawing (`window.draw`).
4. `src/js/main.js` — game loop, keyboard input, overlay screens. Entry point.

Key design rules already in the code:

- `MAZE` (in `maze.js`) is **pristine and never mutated**. Each new game copies
  it (`MAZE.map(row => row.slice())`) into `game.grid`, which is the mutable
  copy used during play. Preserve this split.
- Tile values: `0` empty/walkable, `1` wall, `2` dot, `3` pen door.
- Coordinates: cell `(x, y)`, origin **top-left**, `x in [0,27]`, `y in [0,30]`.
- Speeds are in **cells/frame** (e.g. `0.125` = 1/8 cell per frame).
- The tunnel wraps on row `TUNNEL_ROW` (14).

## Code style guidelines

### Imports / modules

No ES modules. Do **not** add `import`/`export`. New files are wired by adding
a `<script>` tag to `src/index.html` in the correct order and exposing symbols
via `window.*`. Keep each file's dependency on globals explicit in its header
comment (e.g. `maze.js` globals listed at the top of `game.js`).

### File headers

Every JS file starts with a `// filename.js` comment and a one-to-two line
Spanish description of its responsibility and dependencies. Follow this pattern
for new files.

### Formatting (this is the most distinctive convention)

- **2-space indentation.**
- **Spaces inside parentheses** for calls and definitions:
  `function parseTile( ch )`, `MAZE_STR.map( ( row ) => ... )`.
- **Spaces inside square brackets** for indexing: `grid[ y ][ x ]`,
  `DIRS[ dir ]`, `grid[ 0 ].length`.
- **Single quotes** for strings: `'#'`, `'left'`.
- **Semicolons** are used on statements.
- One statement per line; no comma-chained declarations.

### Variables and types

- Plain JavaScript, no TypeScript, no JSDoc annotations in current code.
- `const` by default; `let` only when reassignment is needed; **never `var`**.
- Destructure when convenient: `const { cx, cy } = cellCenter( x, y );`.

### Functions

- Top-level functions use **named `function` declarations**
  (`function movePacman( game ) { ... }`), not function expressions.
- Use **arrow functions** for callbacks: `.map( ( g ) => ( { ... } ) )`,
  `.filter( ( dir ) => ... )`.
- Prefer `for...of`, `.forEach`, `.map`, `.filter` over index `for` loops
  (index loops are used only for grid traversal).

### Naming conventions

- `UPPER_SNAKE_CASE` for module-level constants: `MAZE`, `DIRS`, `TILE`,
  `PACMAN_SPEED`, `GHOST_COLORS`, `KEY_DIR`.
- `camelCase` for functions and local variables: `createGame`, `isWall`,
  `canMove`, `wrapTunnel`, `decideGhost`, `cellCenter`, `bestDist`.
- Object keys stay short and lowercase: `{ x, y, dir, kind }`.
- Boolean helpers read as predicates: `aligned( v )`, `collides( a, b )`.

### Error handling

The codebase favors **defensive guards over thrown exceptions** — this is a
game loop, so a thrown error would freeze rendering. Follow the same pattern:

- Bounds checks before access: `isWall` guards `y`/`x` against the grid edges.
- Early returns on invalid input: `if ( !d ) return false;`.
- Fallback values instead of crashes: `DIRS[ g.dir ] || { x: 0, y: 0 }`,
  `GHOST_COLORS[ i ] || '#ff0000'`.
- Do not introduce `try/catch` unless a new API genuinely requires it.

### Comments

Comments are **Spanish** and explain *why*, not *what*. Inline `//` comments
document non-obvious decisions (speed tuning, tunnel wrapping, arcade-style
wall drawing). Do not over-comment obvious code. Match the existing tone.

## Spec Driven Development workflow

This repo uses the bundled `/spec` and `/spec-impl` skills
(`.agents/skills/`). Follow them for new features.

- **Specs live in `specs/`**, named `NN-slug.md` with a zero-padded number
  (e.g. `01-maze-and-movement.md`). Numbers are sequential.
- **Spec states:** `Draft`, `In review`, `Approved`, `Implemented`, `Obsolete`
  (Spanish equivalents like `Borrador` / `Aprobado` are also accepted — pick
  one set and stay consistent).
- Use `/spec <feature>` to design a spec. **Never write code during `/spec`** —
  only the spec `.md` file. Specs are saved in `Draft` by default; the human
  flips the state to `Approved`.
- Use `/spec-impl NN-slug` to implement an approved spec. It creates a branch
  `spec-NN-slug`, then implements the plan **step by step, pausing after each
  step for review**. Only implement specs whose state means "Approved".
- **Never commit automatically.** Committing is the user's explicit decision.
- Each implementation plan step must leave the game **runnable**; acceptance
  criteria are a boolean checklist you verify manually in the browser.

## Git conventions

- Branch name for spec work: `spec-NN-slug`.
- Only commit when the user explicitly asks. Never push without an explicit
  request. Never amend or force-push.
