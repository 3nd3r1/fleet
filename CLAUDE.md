# fleet

Landing page for eros.ender.fi. Mostly a visual flex: a live-looking map of my
servers and the projects running on them.

## Status

The map runs on real data: statuses, names and links from Coolify, CPU/RAM/
uptime from Beszel. Deployed on Coolify as `fleet-frontend` (redeploy is
manual until the GitHub webhook is added). Repo: github.com/3nd3r1/fleet (private).

Decided so far:

- Project name `fleet`. Page title is `eros.ender.fi`.
- Stack: Svelte 5 + Vite + Tailwind v4 for the page. A Bun server
  (`server/index.ts`) in the same container serves `dist/` and `/api/*`, and
  proxies Coolify (Beszel later). TypeScript is pinned to 6.x because
  typescript-eslint doesn't support 7 yet.
- Coolify is not its own node. It's what runs eros, and eros's role says so.
- Fleet should work for anyone's Coolify. No personal values in code or in the
  image: names, descriptions, links and machines live in config. Mine is
  `deploy/eros.ender.fi.json`. A local `fleet.config.json` is gitignored.
- Release form: a Docker image on GHCR (`ghcr.io/3nd3r1/fleet`) built on `v*`
  tags, configured with env vars and an optional config. Later, a Coolify
  one-click template (`examples/coolify-template.yaml`). No npm package.
- User docs: `README.md`, `docs/configuration.md`. Dev docs:
  `docs/development.md`. Keep them in sync when behavior changes, and add
  user-visible changes to `CHANGELOG.md` under Unreleased.

Still open:

- Beszel agents on dragon and graff (bean is done). Until they're added in the
  hub, the outposts show "no signal".
- jane (phone) has no Beszel agent. Plan: a token-protected
  `POST /api/heartbeat/<machine>` that a phone automation app (HTTP Shortcuts,
  Tasker, Termux) calls every few minutes, optionally with battery level. Up
  while heartbeats arrive, offline when they stop. Alternative if I use
  Tailscale: online status from the Tailscale API. Termux + Beszel agent was
  rejected (Android blocks CPU stats, kills background processes).
- Descriptions for commute-ai, mantray, neko-vesio, propaganda-radar,
  ragebaitor and vebbi (`deploy/eros.ender.fi.json`).
- Before the first release: the name (fleet is a common name), a generic
  favicon (`public/` has my personal icons), screenshots for the README,
  making the repo and the GHCR package public.

## Design

The look is space, Ender's Game themed, kept simple: a flat 2D tactical map,
like the command screen on Eros. No 3D, no glow gradients, no glassmorphism,
no decorative filler. Motion and changing numbers are what make it feel alive.

- eros: the asteroid itself, a peanut outline turning slowly at the center,
  with range rings and bearing ticks around it.
- Projects: ship chevrons on three orbits. Up ships orbit at full speed,
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
- Intro, first visit only: boot lines type out while data loads
  ("establishing ansible link", "contacting <core>", "<n> ships · <m>
  outposts" with real counts), then the overlay fades and the ships launch
  from the core into orbit. No fixed delay beyond about a second. Seen flag
  is `fleet:intro-seen` in localStorage (not a cookie). `?intro` replays it.
  Logic in `src/lib/intro.ts`, overlay in `Boot.svelte`.
- Respects `prefers-reduced-motion` (no intro, orbiting, twinkling or
  blinking).

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
bun run doctor       # Check the setup (config, Coolify, Beszel)
bun run schema       # Regenerate fleet.schema.json after config schema changes
bun run docker:build # Build the image
```

## Structure

```
src/
├── App.svelte             # Layout, hover/selection state
├── main.ts                # Mounts App, loads fonts
├── app.css                # Tailwind entry, theme tokens, keyframes
├── components/            # FleetMap, NodePanel, Roster, EventLog, Sparkline, Starfield, Boot
├── lib/
│   ├── fleet.svelte.ts    # The one place data is loaded (mock or /api/fleet)
│   ├── mock.ts            # Mock fleet that changes over time
│   ├── events.ts          # Status-change diffing for the log
│   ├── geometry.ts        # Orbits, outposts, asteroid and bracket paths
│   ├── intro.ts           # First-visit intro: when to play, launch easing
│   └── nodes.ts           # allNodes, status labels/colors, counts
└── validators/            # Zod schemas: fleet.ts (API contract), config.ts (fleet.config.json)
server/
├── index.ts               # Bun server: /api/*, static dist/, title injection
├── runtime.ts             # Reads env, wires Coolify + Beszel into one loader
├── doctor.ts              # Setup checks (bun server/doctor.ts)
├── config.ts              # FLEET_CONFIG_JSON, FLEET_CONFIG, ./fleet.config.json
├── coolify.ts             # Coolify client, whitelists fields
├── beszel.ts              # Beszel client (read-only user), whitelists fields
└── fleet.ts               # Grouping, statuses, safe links, cache
scripts/schema.ts          # Writes fleet.schema.json (bun run schema)
deploy/eros.ender.fi.json  # My deployment's config
examples/                  # docker-compose.yml, coolify-template.yaml
docs/                      # configuration.md (users), development.md
tests/                     # Mirrors src/ and server/
public/                    # Favicons, copied as-is into dist/
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

## Projects on eros

Comes from Coolify. Resources are grouped by name (`bloglist-frontend` +
`bloglist-backend` → `bloglist`, see `projectName` in `server/fleet.ts`).
Per-project names, descriptions, links and hiding are in `fleet.config.json`.
The mock in `src/lib/mock.ts` uses generic sample names, not mine.

## What the page does

- Graph with eros in the center, the projects connected to it, and my other
  machines around it.
- Every node has a status: up, degraded or down. `unknown` ("no signal") is
  for nodes with no data source yet.
- Hovering or tapping a node shows what it is and some metrics (CPU, RAM).
- It should feel alive, with motion and changing values. Not a static diagram.
- Works on a phone.

## Data

- `src/lib/fleet.svelte.ts` is the one place the page loads data. Production
  builds poll `/api/fleet` every 15 s. Dev uses `src/lib/mock.ts`, which
  changes every 2 s. `VITE_FLEET_SOURCE=api|mock` overrides.
- `/api/fleet` (`server/fleet.ts`) asks Coolify for servers, applications,
  services and databases, cached for 20 s and shared between all visitors. If
  Coolify fails, the last good result is served. With nothing cached it
  returns 502 without upstream details.
- `server/coolify.ts` parses responses with Zod schemas that whitelist the
  fields fleet uses, so IPs, ports and versions are dropped at the edge.
  Descriptions that look like an IP, port or version are dropped too.
- Coolify statuses: `running:*` → up (`running:unhealthy` → degraded),
  `restarting`/`starting`/`degraded` → degraded, anything else → down. A
  project takes the worst status of its resources.
- Links: the first plain `https` domain of a non-internal resource. Never
  backends/APIs/agents, ports, IPs or sslip.io/nip.io hosts. Config `url`
  overrides it, and `false` turns it off.
- Metrics come from Beszel (`server/beszel.ts`) through a read-only hub user.
  Only system name, status, cpu, mem %, uptime, total memory and per-container
  cpu/mem are parsed. Host, port, hostname, kernel and versions never are.
- The core and machines match Beszel systems by name, case-insensitively
  (`beszel` in the config overrides). A project's CPU/RAM is the sum of the
  containers whose name contains one of its Coolify uuids; RAM is a percent
  of the host's total memory.
- Beszel statuses: up → up, down → down (machines show "offline"),
  paused/pending/missing → unknown ("no signal").
- Beszel is optional. If it's not configured or fails, metrics are `null`
  and the page shows "—". It never breaks the Coolify data.
- Config comes from `FLEET_CONFIG_JSON`, then `FLEET_CONFIG`, then
  `./fleet.config.json`, then defaults (`server/config.ts`). It's parsed with
  `src/validators/config.ts` at startup, and a bad config stops the server
  with a readable error. After changing the schema, run `bun run schema`.
- `FLEET_CACHE_SECONDS` (default 20, min 5) sets the backend cache.
  `site.intro: false` turns the intro off (the server sets `data-intro` on
  `<html>`).
- Env (server only, never `VITE_`-prefixed): `COOLIFY_URL`, `COOLIFY_TOKEN`
  (read-only token), `BESZEL_URL`, `BESZEL_EMAIL`, `BESZEL_PASSWORD`
  (read-only hub user). Locally in `.env`, which Bun loads. In production, set
  them as runtime env vars on the Coolify app (not build variables).
- To run locally against Coolify: `bun run dev:server` and
  `VITE_FLEET_SOURCE=api bun run dev`. Locally `fleet.config.json` is a copy
  of `deploy/eros.ender.fi.json`.

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
- The Coolify token and Beszel login must never reach the browser. Only the
  backend talks to Coolify and Beszel.
- Never read or print `.env`. Test through the running server instead.
- It's deployed on Coolify on eros, so keep it light.
