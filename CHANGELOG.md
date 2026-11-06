# Changelog

## Unreleased

First release.

- Live map of a Coolify server: the host in the middle, projects orbiting as
  ships, machines outside Coolify as outposts at the edge
- Statuses, names, descriptions and links from Coolify, with resources grouped
  into projects by name
- CPU, RAM and uptime from Beszel for the host, each project and each machine
- Optional `fleet.config.json` or `FLEET_CONFIG_JSON` for titles, names,
  descriptions, links, hidden projects, grouping and machines
- Heartbeats for machines without a Beszel agent, like a phone:
  `POST /api/heartbeat/<machine>` with `FLEET_HEARTBEAT_TOKEN`, optionally
  with the battery level
- `bun server/doctor.ts` to check a setup
- Boot sequence and ship launch on a visitor's first visit
- Docker image for amd64 and arm64
