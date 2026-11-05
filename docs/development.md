# Development

Fleet is a Svelte page and a small Bun server in one container. The server
reads Coolify and Beszel, builds one JSON snapshot of the fleet, caches it, and
serves it on `/api/fleet` next to the built page.

## Setup

You need Bun. With Nix, `nix-shell` or `direnv allow` gives you the same
version as CI.

```bash
bun install
bun run dev            # the page on mock data, no backend needed
```

To work against a real Coolify, put `COOLIFY_URL` and `COOLIFY_TOKEN` (and the
Beszel variables if you have them) in `.env`, then run both:

```bash
bun run dev:server                   # backend on :3000, reads .env
VITE_FLEET_SOURCE=api bun run dev    # page, proxies /api to :3000
```

`.env` and `fleet.config.json` in the repo root are gitignored, so local
settings stay local.

## Commands

```bash
bun run build          # build the page into dist/
bun run start          # serve dist/ and /api like production
bun run lint           # ESLint and Prettier
bun run type-check     # svelte-check, covers .ts and .svelte
bun run test           # Vitest
bun run doctor         # check the setup in .env and the config
bun run schema         # regenerate fleet.schema.json after changing the config schema
```

## Layout

```
src/
├── App.svelte             layout, hover and selection
├── components/            map, side panel, roster, log, boot sequence
├── lib/fleet.svelte.ts    the one place the page loads data (mock or /api/fleet)
├── lib/mock.ts            generic mock data for development
└── validators/            Zod schemas: fleet.ts is the API, config.ts the config
server/
├── index.ts               HTTP server, /api routes, title injection
├── runtime.ts             reads the environment, wires the sources together
├── config.ts              finds and validates the config
├── coolify.ts             Coolify client
├── beszel.ts              Beszel client
├── fleet.ts               grouping, statuses, links, metrics, cache
└── doctor.ts              the doctor command
deploy/                    config for my own instance
examples/                  Compose file and a Coolify service template
```

The Coolify and Beszel clients parse responses with Zod schemas that list only
the fields fleet uses. Anything new that comes from them has to be added to
those schemas on purpose. Keep it that way, because the page is public.

## Tests

Tests live in `tests/` and mirror `src/` and `server/`. Server tests start
with `// @vitest-environment node`, because jsdom replaces `URL`. They call
handlers and clients directly with fake `fetch` functions, so no network or
running server is needed.

## Releasing

Releases are Docker images on GHCR, built by `.github/workflows/release.yml`.

1. Bump `version` in `package.json` and move the changes in `CHANGELOG.md`
   from Unreleased to the new version.
2. Commit, then tag and push:
    ```bash
    git tag v0.1.0
    git push origin v0.1.0
    ```

The workflow runs the checks, fails if the tag doesn't match `package.json`,
builds the image for amd64 and arm64, pushes `ghcr.io/3nd3r1/fleet` tagged
with the version, `major.minor` and `latest`, and creates a GitHub release.

The first time, make the package public in the repo's package settings on
GitHub, or nobody else can pull it.

`examples/coolify-template.yaml` is a draft of a Coolify one-click service.
It can be submitted to Coolify's template list once the image is public.
