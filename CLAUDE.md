# fleet

Landing page for eros.ender.fi. Mostly a visual flex: a live-looking map of my
servers and the projects running on them.

## Status

Tooling is set up with a placeholder page. No visuals yet.
Repo: github.com/3nd3r1/fleet (private).

Decided so far:

- Project name `fleet`. Page title is `eros.ender.fi`.
- Stack: Svelte 5 + Vite + Tailwind v4 for the page. A Bun server
  (`server/index.ts`) in the same container serves `dist/` and `/api/*`, and
  will later proxy Coolify/Beszel. TypeScript is pinned to 6.x because
  typescript-eslint doesn't support 7 yet.

Still open. Ask me about these before building anything:

1. Which projects are still running on eros (list below may be outdated), and
   whether Coolify itself should be a node.
2. Visual direction. Options I've been given: tactical display (dark, glowing
   lines, mono font, Ender command-screen feel), clean minimal (Linear/Vercel
   feel), or space/orbital (eros as a planet, projects orbiting it).
3. How the non-eros machines show up: a dimmer outer ring, or linked to eros
   (e.g. bean deploys to eros).
4. Colors and fonts. Propose these after the visual direction is picked.

Don't pick colors or fonts yourself. Propose options and ask.

## Commands

Run inside the Nix shell (`direnv allow` once, or `nix-shell`).

```bash
bun run dev          # Vite dev server, proxies /api to :3000
bun run dev:server   # Bun server with watch, on :3000
bun run build        # Build the page into dist/
bun run start        # Serve dist/ and /api with the Bun server
bun run lint         # ESLint + Prettier check
bun run lint:fix     # Fix ESLint errors
bun run format       # Format with Prettier
bun run test         # Run all tests
bun run coverage     # Tests with coverage
bun run type-check   # svelte-check (covers .ts and .svelte)
bun run docker:build # Build the image
```

## Structure

```
src/
├── App.svelte       # Root component
├── main.ts          # Mounts App
├── app.css          # Tailwind entry
├── components/      # Svelte components
├── lib/             # config.ts (site details), data loading, utils
└── validators/      # Zod schemas
server/index.ts      # Bun server: /api/* + static dist/
tests/               # Mirrors src/ and server/
public/              # Favicons, copied as-is into dist/
```

## Machines (named after Ender's Game)

- eros: VPS running Coolify. Hosts all my projects, including this page.
  The Coolify dashboard is at coolify.eros.ender.fi. Apps get *.eros.ender.fi
  or their own *.ender.fi names.
- bean: laptop (NixOS, Hyprland)
- graff: work Mac
- dragon: desktop
- jane: phone (Pixel 10)

DNS is on Cloudflare. ender.fi itself is my personal site.

## Projects on eros (to be confirmed)

ender-page, timescaledb-tune, booru, datakolo, bloglist, millonkutsunnat,
protaskinate, thrivy, ender-drive.

## What the page does

- Graph with eros in the center, the projects connected to it, and my other
  machines around it.
- Every node has a status: up, degraded or down.
- Hovering or tapping a node shows what it is and some metrics (CPU, RAM).
- It should feel alive, with motion and changing values. Not a static diagram.
- Works on a phone.

## Data

- Start with mock data in one file that changes over time, so the visuals can
  be built first.
- Later, real data comes from the Coolify API (servers, apps, status) and Beszel
  (server metrics), through a small backend that caches every 15-30 seconds.
- Keep data loading in one place so switching from mock to real is a small change.

## Conventions (carried over from nextjs-template)

- 4-space indent, LF, double quotes, semicolons, es5 trailing commas
  (`.editorconfig`, `.prettierrc`). YAML uses 2 spaces.
- Imports sorted by `@trivago/prettier-plugin-sort-imports`: packages, then
  `@/validators`, `@/lib`, `@/components`, then relative.
- `@/` path alias points to `src/`.
- Zod schemas go in `src/validators/`, and types come from `z.infer<>`. Use them
  for the node/status data shape and to validate Coolify/Beszel responses.
- Tests live in `tests/` and mirror `src/` and `server/`. Use Vitest. Server
  tests start with `// @vitest-environment node`, because jsdom swaps out `URL`.
- Server tests import the handlers directly (`handleApi`), with no running server.
- Scripts: `lint` (ESLint + Prettier check), `lint:fix`, `format`, `test`,
  `coverage`, `type-check`. CI runs lint, type-check and coverage on push/PR to main.
- Docker: multi-stage build, run as a non-root user.
- Dev shell through Nix (`shell.nix` + direnv).
- Be concise. Read docs when unsure. Follow the existing structure.

## Git

- Conventional commits: `type: description` or `type(scope): description`.
  Lowercase, imperative, no trailing period. Example: `feat: add mock data
that changes over time`.
- Types: `feat` (new behavior), `fix` (bug fix), `chore` (tooling, config,
  deps, formatting), `docs` (README, CLAUDE.md), `build` (Dockerfile, deploy),
  `ci` (workflows), `test` (tests only), `refactor` (no behavior change).
- Make small commits, one logical change each. Don't bundle unrelated work.
- Never add `Co-Authored-By` trailers or any other AI attribution to commits
  or PR descriptions.

## Hard rules

- The page is public. Never show IPs, ports or software versions, not even in
  mock data.
- The Coolify API token must never reach the browser. Only the backend talks to Coolify.
- It's deployed on Coolify on eros, so keep it light.
