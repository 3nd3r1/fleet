# Configuration

Fleet runs with no configuration. Everything below is optional and overrides
what Coolify and Beszel report.

## Environment variables

| Variable              | Required | What it is                                                            |
| --------------------- | -------- | --------------------------------------------------------------------- |
| `COOLIFY_URL`         | yes      | Your Coolify dashboard, like `https://coolify.example.com`            |
| `COOLIFY_TOKEN`       | yes      | A Coolify API token with only the `read` permission                   |
| `BESZEL_URL`          | no       | Your Beszel hub, for metrics                                          |
| `BESZEL_EMAIL`        | no       | A verified hub user with the read-only role                           |
| `BESZEL_PASSWORD`     | no       | That user's password                                                  |
| `FLEET_CONFIG_JSON`   | no       | The config itself, as JSON                                            |
| `FLEET_CONFIG`        | no       | Path to a config file                                                 |
| `FLEET_CACHE_SECONDS` | no       | How long Coolify and Beszel answers are reused. Default 20, minimum 5 |
| `PORT`                | no       | Port to listen on. Default 3000                                       |

Set the secrets as runtime variables. On Coolify that means leaving the build
variable option off. None of them ever reach the browser.

## Where the config is read from

The first one found wins:

1. `FLEET_CONFIG_JSON`
2. the file at `FLEET_CONFIG` (fleet won't start if it's missing)
3. `fleet.config.json` in the working directory, which is `/app` in the image
4. defaults

On Coolify, the easiest way to edit the config is a File Mount: open the app,
go to Persistent Storage, add a File Mount with the destination
`/app/fleet.config.json` and paste the config into it. Edit it there later and
restart the app, because the config is read at startup.

A config with a typo or an unknown key stops the server with an error that
names the field. Add `"$schema": "./fleet.schema.json"` to get autocomplete and
the same checks in your editor. [`fleet.config.example.json`](../fleet.config.example.json)
uses most options.

## Reference

### `site`

| Key           | Default                                                   | What it does                                      |
| ------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `title`       | `fleet`                                                   | Page title and the heading in the corner          |
| `description` | `A live map of servers and the projects running on them.` | The meta description, used in link previews       |
| `intro`       | `true`                                                    | Play the boot sequence on a visitor's first visit |

### `core`

The Coolify host in the middle of the map.

| Key           | Default                                       | What it does                                   |
| ------------- | --------------------------------------------- | ---------------------------------------------- |
| `name`        | the server's name in Coolify, or `server`     | Label on the map                               |
| `role`        | `coolify host`                                | Small text above the name in the side panel    |
| `description` | `Runs Coolify and every project orbiting it.` | Side panel text                                |
| `beszel`      | same as `name`                                | Beszel system to take CPU, RAM and uptime from |

### `grouping`

Coolify resources become projects by name. Fleet lowercases the name, drops
anything after a `/`, and strips known endings until none is left:
`commute-ai-backend-database` becomes `commute-ai`.

| Key        | Default                                                             | What it does                                         |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| `suffixes` | `frontend`, `backend`, `page`, `ui`, `database`, `db`, `api`, `web` | Endings to strip. Replaces the defaults              |
| `aliases`  | `{}`                                                                | Map a Coolify resource name straight to a project id |

A project's status is the worst status of its resources. Coolify's
`running:healthy` and `running:unknown` are up, `running:unhealthy`,
`restarting` and `starting` are degraded, and anything else is down.

### `projects`

Settings per project, keyed by the grouped project id. Run the doctor to see
the ids, it also warns about keys that match no project.

| Key           | What it does                                                      |
| ------------- | ----------------------------------------------------------------- |
| `name`        | Display name instead of the id                                    |
| `description` | One line for the side panel. Overrides the description in Coolify |
| `url`         | An `https` link for the side panel, or `false` for no link        |
| `hidden`      | `true` leaves the project off the page                            |

Without `url`, fleet links the first plain `https` domain of the project's
resources. It skips resources named like a backend, API, database, worker or
agent, and any domain with a port, an IP, or an sslip.io, nip.io or traefik.me
host.

### `machines`

Machines outside Coolify, like your laptop. They sit at the edge of the map and
get their status from Beszel.

| Key           | Default        | What it does                             |
| ------------- | -------------- | ---------------------------------------- |
| `id`          | required       | Lowercase letters, numbers and dashes    |
| `name`        | same as `id`   | Label on the map                         |
| `role`        | `machine`      | Small text under the name, like `laptop` |
| `description` | empty          | Side panel text                          |
| `beszel`      | same as `name` | Beszel system to match                   |

A machine is up when its Beszel system is up, offline when it's down, and "no
signal" when Beszel doesn't know it, or the system is paused or pending.

## Metrics

With Beszel configured:

- the core gets its system's CPU, memory use and uptime
- each project gets the summed CPU and memory of its containers. Coolify puts
  the resource's uuid in every container name, which is how they're matched.
  Memory is shown as a percent of the host's total
- machines get their system's CPU, memory use, uptime and status

Without Beszel the panel shows a dash instead of numbers.
