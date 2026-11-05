import type { FleetConfig } from "../src/validators/config";
import type { Fleet, FleetNode, Status } from "../src/validators/fleet";

import type { CoolifyResource, CoolifySnapshot } from "./coolify";

// Groups related Coolify resources into one project by stripping known
// suffixes: "blog-frontend", "blog-backend" → "blog". Anything before a "/"
// is the project too: "commute-ai/ai-agents" → "commute-ai".
export function projectName(
    name: string,
    grouping: FleetConfig["grouping"]
): string {
    const alias = grouping.aliases[name];
    if (alias) return alias;

    const suffix = new RegExp(
        `-(${grouping.suffixes.map(escapeRegExp).join("|")})$`
    );
    let current = name.toLowerCase().split("/")[0].trim();
    let previous;
    do {
        previous = current;
        current = current.replace(suffix, "");
    } while (current !== previous && current.length > 0);
    return current || name.toLowerCase();
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

// Only plain https links on a real domain. No ports, no IPs, no sslip.io or
// nip.io style hosts (they contain the server's IP).
export function safeUrl(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    const host = parsed.hostname;
    if (parsed.protocol !== "https:" || parsed.port) return null;
    if (/(^|\.)(sslip\.io|nip\.io|traefik\.me)$/.test(host)) return null;
    if (!isSafeText(host) || host.includes(":")) return null;
    return parsed.origin;
}

// Backends, APIs, workers and agents are not something to link to.
const INTERNAL = /(^|[-/])(backend|api|database|db|worker|agents?)($|[-/])/;

export function publicUrl(members: CoolifyResource[]): string | null {
    for (const member of members) {
        for (const domain of member.domains) {
            if (INTERNAL.test(domain.name.toLowerCase())) continue;
            const url = safeUrl(domain.url);
            if (url) return url;
        }
    }
    return null;
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

function safeOr(text: string | undefined, fallback = ""): string {
    return text && isSafeText(text) ? text : fallback;
}

export function buildFleet(
    snapshot: CoolifySnapshot,
    config: FleetConfig,
    now: number
): Fleet {
    const groups = new Map<string, CoolifyResource[]>();
    for (const resource of snapshot.resources) {
        const id = projectName(resource.name, config.grouping);
        if (config.projects[id]?.hidden || !isSafeText(id)) continue;
        groups.set(id, [...(groups.get(id) ?? []), resource]);
    }

    const projects: FleetNode[] = [...groups.entries()]
        .map(([id, members]): FleetNode => {
            const settings = config.projects[id] ?? {};
            const fromCoolify = members
                .map((m) => m.description?.trim() ?? "")
                .find((d) => d && isSafeText(d));
            const url =
                settings.url === false
                    ? null
                    : settings.url
                      ? safeUrl(settings.url)
                      : publicUrl(members);
            return {
                id,
                name: safeOr(settings.name, id),
                kind: "project",
                role: roleFor(members),
                description: safeOr(settings.description ?? fromCoolify),
                status: worstStatus(
                    members.map((m) => resourceStatus(m.status))
                ),
                cpu: null,
                ram: null,
                url,
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const host =
        snapshot.servers.find((s) => s.is_coolify_host) ?? snapshot.servers[0];
    const hostUp =
        !!host && host.is_reachable !== false && host.is_usable !== false;
    const hostName =
        host && host.name !== "localhost" && isSafeText(host.name)
            ? host.name
            : "server";

    return {
        updatedAt: now,
        site: {
            title: config.site.title,
            description: config.site.description,
        },
        core: {
            id: "core",
            name: config.core.name ?? hostName,
            kind: "core",
            role: config.core.role,
            description: config.core.description,
            status: hostUp ? "up" : "down",
            cpu: null,
            ram: null,
            url: null,
        },
        projects,
        // Machines come from the config. Their status comes from Beszel later.
        machines: config.machines.map((m) => ({
            id: `machine-${m.id}`,
            name: m.name ?? m.id,
            kind: "machine",
            role: m.role,
            description: m.description,
            status: "unknown",
            cpu: null,
            ram: null,
            url: null,
        })),
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
