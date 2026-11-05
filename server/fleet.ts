import type { Fleet, FleetNode, Status } from "../src/validators/fleet";

import type { CoolifyResource, CoolifySnapshot } from "./coolify";
import { MACHINES } from "./machines";
import { DESCRIPTIONS, HIDDEN } from "./projects";

const SUFFIX = /-(frontend|backend|page|ui|database|db|api|web)$/;

// Groups related Coolify resources into one project:
// "bloglist-frontend", "bloglist-backend" → "bloglist",
// "commute-ai/ai-agents", "commute-ai-backend-database" → "commute-ai".
export function projectName(name: string): string {
    let current = name.toLowerCase().split("/")[0].trim();
    let previous;
    do {
        previous = current;
        current = current.replace(SUFFIX, "");
    } while (current !== previous && current.length > 0);
    return current || name.toLowerCase();
}

// Coolify statuses look like "running:healthy", "running:unknown",
// "running:unhealthy", "exited:unhealthy", "restarting".
export function resourceStatus(status: string | null | undefined): Status {
    const [state = "", health = ""] = (status ?? "").toLowerCase().split(":");
    if (state.startsWith("running")) {
        return health === "unhealthy" ? "degraded" : "up";
    }
    if (
        ["degraded", "restarting", "starting"].some((s) => state.startsWith(s))
    ) {
        return "degraded";
    }
    return "down";
}

const SEVERITY: Status[] = ["up", "degraded", "down"];

export function worstStatus(statuses: Status[]): Status {
    return statuses.reduce<Status>(
        (worst, s) =>
            SEVERITY.indexOf(s) > SEVERITY.indexOf(worst) ? s : worst,
        "up"
    );
}

// The page is public: never show anything that looks like an IP, a port or
// a version, even if someone typed it into a Coolify description.
const UNSAFE = [
    /\b\d{1,3}(\.\d{1,3}){3}\b/,
    /:\d{2,5}\b/,
    /\bv?\d+\.\d+(\.\d+)?\b/,
];

export function isSafeText(text: string): boolean {
    return !UNSAFE.some((pattern) => pattern.test(text));
}

function roleFor(members: CoolifyResource[]): string {
    const count = (type: CoolifyResource["type"]) =>
        members.filter((m) => m.type === type).length;
    const apps = count("app");
    const services = count("service");
    const dbs = count("db");
    const parts = [
        apps && `${apps} app${apps > 1 ? "s" : ""}`,
        services && `${services} service${services > 1 ? "s" : ""}`,
        dbs && `${dbs} db`,
    ].filter(Boolean);
    return parts.join(" · ") || "project";
}

export function buildFleet(snapshot: CoolifySnapshot, now: number): Fleet {
    const groups = new Map<string, CoolifyResource[]>();
    for (const resource of snapshot.resources) {
        const id = projectName(resource.name);
        if (HIDDEN.has(id) || !isSafeText(id)) continue;
        groups.set(id, [...(groups.get(id) ?? []), resource]);
    }

    const projects: FleetNode[] = [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, members]) => {
            const fromCoolify = members
                .map((m) => m.description?.trim() ?? "")
                .find((d) => d && isSafeText(d));
            return {
                id,
                name: id,
                kind: "project",
                role: roleFor(members),
                description: DESCRIPTIONS[id] ?? fromCoolify ?? "",
                status: worstStatus(
                    members.map((m) => resourceStatus(m.status))
                ),
                cpu: null,
                ram: null,
            };
        });

    const host =
        snapshot.servers.find((s) => s.is_coolify_host) ?? snapshot.servers[0];
    const hostUp =
        !!host && host.is_reachable !== false && host.is_usable !== false;

    return {
        updatedAt: now,
        core: {
            id: "eros",
            name: "eros",
            kind: "core",
            role: "vps · coolify",
            description:
                "Runs Coolify and every project orbiting it, this page included.",
            status: hostUp ? "up" : "down",
            cpu: null,
            ram: null,
        },
        projects,
        machines: MACHINES,
    };
}

// Caches the fleet so Coolify is asked at most once per ttl, no matter how
// many people have the page open. On an error the last good value is served.
export function createFleetCache(
    load: () => Promise<Fleet>,
    ttl = 20_000,
    now: () => number = Date.now
) {
    let value: Fleet | null = null;
    let loadedAt = 0;
    let pending: Promise<Fleet> | null = null;

    return async function get(): Promise<Fleet> {
        if (value && now() - loadedAt < ttl) return value;
        pending ??= load()
            .then((fresh) => {
                value = fresh;
                loadedAt = now();
                return fresh;
            })
            .finally(() => {
                pending = null;
            });
        try {
            return await pending;
        } catch (error) {
            if (value) return value;
            throw error;
        }
    };
}
