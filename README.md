# fleet

A live map of a Coolify server and the projects running on it. The server sits
in the middle as an asteroid, projects orbit it as ships, and other machines
sit at the edge as outposts. Each node is up, degraded or down, and the page
updates on its own. Mine runs at [eros.ender.fi](https://eros.ender.fi).

## Run it

You need a Coolify API token with only the `read` permission
(Keys & Tokens → API tokens in Coolify).

Set two environment variables on the server:

```
COOLIFY_URL=https://coolify.example.com
COOLIFY_TOKEN=your-read-only-token
```

On Coolify, deploy this repo with the Dockerfile build pack on port 3000 and
add both variables as runtime variables (not build variables). Locally, put
them in `.env` and run:

```bash
bun install
bun run build && bun run start   # http://localhost:3000
```

That's all you need. Without a config file, fleet shows whatever Coolify
knows: names, statuses, domains and descriptions.

## Configure it

Put a `fleet.config.json` next to the server, or point `FLEET_CONFIG` at one.
Every field is optional. See
[`fleet.config.example.json`](fleet.config.example.json), and add
`"$schema": "./fleet.schema.json"` for autocomplete in your editor.

| Key                 | What it does                                                     |
| ------------------- | ---------------------------------------------------------------- |
| `site`              | Page title and description                                       |
| `core`              | Name, role and description of the Coolify host                   |
| `grouping.suffixes` | Name endings that group resources (`blog-frontend` → `blog`)     |
| `grouping.aliases`  | Map a Coolify resource name to a project                         |
| `projects.<id>`     | Per project: `name`, `description`, `url` (or `false`), `hidden` |
| `machines`          | Machines outside Coolify, shown at the edge of the map           |

Projects are keyed by their grouped id. With the default suffixes,
`blog-frontend`, `blog-backend` and `blog-database` all become `blog`.

## What's public

The page is meant to be public, so the backend is strict about what it sends:

- Only the backend talks to Coolify. The token never reaches the browser.
- Coolify responses are parsed against a whitelist of fields, so IPs, ports,
  versions and settings are dropped before anything else happens.
- Descriptions that look like an IP, port or version are dropped.
- Links are only shown for plain `https` domains. Backends, APIs, agents,
  ports, IPs and sslip.io-style hosts are never linked.
- Coolify is asked at most once every 20 seconds, however many people have
  the page open.

Every project name in Coolify shows up on the page. Hide the ones you don't
want public with `"hidden": true`.

## Develop

```bash
nix-shell              # or direnv allow
bun run dev            # page with mock data
bun run dev:server     # backend on :3000 (for VITE_FLEET_SOURCE=api)
bun run lint && bun run type-check && bun run test
bun run schema         # regenerate fleet.schema.json after config changes
```

CPU and RAM aren't shown yet. They'll come from Beszel.
