# fleet

Landing page for eros.ender.fi. Mostly a visual flex: a live-looking map of my
servers and the projects running on them.

## Status

The first version of the map runs on mock data. Not deployed yet, and there's
no real data source yet. Repo: github.com/3nd3r1/fleet (private).

Decided so far:

- Project name `fleet`. Page title is `eros.ender.fi`.
- Stack: Svelte 5 + Vite + Tailwind v4 for the page. A Bun server
  (`server/index.ts`) in the same container serves `dist/` and `/api/*`, and
  will later proxy Coolify/Beszel. TypeScript is pinned to 6.x because
  typescript-eslint doesn't support 7 yet.
- Coolify is not its own node. It's what runs eros, and eros's role says so.

Still open:

- Which projects really run on eros. The mock uses the list below. Repos with
  Coolify webhooks also include vebbi-homepage, timescaledb-tune-ui, viiteri,
  neko-homepage and mantray-homepage. Once real data comes from Coolify, this
  sorts itself out.

## Design

The look is space, Ender's Game themed, kept simple: a flat 2D tactical map,
like the command screen on Eros. No 3D, no glow gradients, no glassmorphism,
no decorative filler. Motion and changing numbers are what make it feel alive.

- eros: the asteroid itself, a peanut outline turning slowly at the center,
  with range rings and bearing ticks around it.
- Projects: ship chevrons on two orbits. Up ships orbit at full speed,
  degraded ones slow down, down ones stop and blink.
- Machines: square outposts at the edge, linked to eros by dashed lines with
  dots moving along them. A machine that's down is shown as "offline" in dim
  gray, not red, because it's just switched off.
- Hover, focus or tap a node: target brackets, a dotted line from eros to the
  ship, and the side panel shows role, status, CPU/RAM bars and a 2 min CPU
  sparkline. Nothing hovered or selected → eros. Escape clears the selection.
- Event log of status changes, plus a roster of every node (on a phone this
  is the main way to pick a node).
- Phone: header, square map, then panel, log and roster stacked. Ship labels
  only show for the active ship, and glyphs are scaled up.
- Respects `prefers-reduced-motion` (no orbiting, twinkling or blinking).

Colors (Tailwind theme in `src/app.css`, dark only):

| token      | value     | use                             |
| ---------- | --------- | ------------------------------- |
| `space`    | `#05070c` | background                      |
| `ink`      | `#cfd7e3` | text, eros, active things       |
| `dim`      | `#6d7b91` | labels, secondary text, offline |
| `faint`    | `#1e2735` | rings, links, borders           |
| `up`       | `#5fd0a2` | status                          |
| `degraded` | `#e6b04b` | status                          |
| `down`     | `#ee5f5a` | status                          |

Color only means status. Everything else is ink, dim or faint.

Font: IBM Plex Mono (400, 500), self-hosted via `@fontsource`, used for
everything. Small uppercase labels with wide letter spacing.

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
├── App.svelte             # Layout, hover/selection state
├── main.ts                # Mounts App, loads fonts
├── app.css                # Tailwind entry, theme tokens, keyframes
├── components/            # FleetMap, NodePanel, Roster, EventLog, Sparkline, Starfield
├── lib/
│   ├── config.ts          # Site details
│   ├── fleet.svelte.ts    # The one place data is loaded (mock or /api/fleet)
│   ├── mock.ts            # Mock fleet that changes over time
│   ├── events.ts          # Status-change diffing for the log
│   ├── geometry.ts        # Orbits, outposts, asteroid and bracket paths
│   └── nodes.ts           # allNodes, status labels/colors, counts
└── validators/            # Zod schemas (fleet.ts is the data contract)
server/index.ts            # Bun server: /api/* + static dist/
tests/                     # Mirrors src/ and server/
public/                    # Favicons, copied as-is into dist/
```

Switching to real data: add `/api/fleet` to the server returning the
`fleetSchema` shape, and build with `VITE_FLEET_SOURCE=api`.

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
