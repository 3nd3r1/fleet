// Checks a fleet setup and says what's wrong: bun server/doctor.ts
// Never prints tokens, passwords, hosts or IPs.
import pkg from "../package.json";

import { type CoolifySnapshot, fetchCoolify } from "./coolify";
import { buildFleet, findSystem, isSafeText, projectName } from "./fleet";
import { type Runtime, readRuntime } from "./runtime";

export type Level = "ok" | "warn" | "fail" | "info";

export interface Check {
    level: Level;
    title: string;
    details?: string[];
}

const reason = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

const list = (items: string[], max = 12) =>
    items.length > max
        ? `${items.slice(0, max).join(", ")} and ${items.length - max} more`
        : items.join(", ");

function strings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") {
        return Object.values(value).flatMap(strings);
    }
    return [];
}

export async function runDoctor(
    runtime: Runtime,
    coolifyFetcher: typeof fetchCoolify = fetchCoolify
): Promise<Check[]> {
    const checks: Check[] = [
        { level: "ok", title: `config loaded from ${runtime.source}` },
    ];
    const { config } = runtime;

    if (!runtime.coolify) {
        checks.push({
            level: "fail",
            title: "COOLIFY_URL and COOLIFY_TOKEN are not both set",
        });
        return checks;
    }

    let snapshot: CoolifySnapshot;
    try {
        snapshot = await coolifyFetcher(
            runtime.coolify.url,
            runtime.coolify.token
        );
    } catch (error) {
        checks.push({
            level: "fail",
            title: "could not read Coolify",
            details: [
                reason(error),
                "Check COOLIFY_URL, that API access is on in Coolify, and that the token has the read permission.",
            ],
        });
        return checks;
    }

    let metrics = null;
    let beszelError: string | null = null;
    if (runtime.fetchBeszel) {
        try {
            metrics = await runtime.fetchBeszel();
        } catch (error) {
            beszelError = reason(error);
        }
    }

    const fleet = buildFleet(snapshot, config, Date.now(), metrics);
    const groupIds = new Set(
        snapshot.resources.map((r) => projectName(r.name, config.grouping))
    );

    checks.push({
        level: "ok",
        title: `Coolify: ${snapshot.servers.length} server(s), ${snapshot.resources.length} resources, shown as ${fleet.projects.length} projects`,
        details: [
            `projects: ${list(
                fleet.projects.map((p) => p.id),
                100
            )}`,
        ],
    });

    const unknown = Object.keys(config.projects).filter(
        (id) => !groupIds.has(id)
    );
    if (unknown.length) {
        checks.push({
            level: "warn",
            title: "config has projects that Coolify doesn't",
            details: [
                list(unknown),
                "Keys in projects must be grouped ids, like the list above.",
            ],
        });
    }

    const hidden = Object.entries(config.projects)
        .filter(([, p]) => p.hidden)
        .map(([id]) => id);
    if (hidden.length) {
        checks.push({ level: "info", title: `hidden: ${list(hidden)}` });
    }

    const noLink = fleet.projects.filter((p) => !p.url).map((p) => p.id);
    if (noLink.length) {
        checks.push({
            level: "info",
            title: `no link: ${list(noLink)}`,
            details: [
                "Only plain https domains of non-backend resources are linked. Set projects.<id>.url to override.",
            ],
        });
    }

    const noDescription = fleet.projects
        .filter((p) => !p.description)
        .map((p) => p.id);
    if (noDescription.length) {
        checks.push({
            level: "info",
            title: `no description: ${list(noDescription)}`,
        });
    }

    if (!runtime.fetchBeszel) {
        checks.push({
            level: "warn",
            title: "Beszel not configured, so there are no metrics",
            details: [
                "Set BESZEL_URL, BESZEL_EMAIL and BESZEL_PASSWORD for CPU, RAM and machine status.",
            ],
        });
    } else if (beszelError || !metrics) {
        checks.push({
            level: "fail",
            title: "could not read Beszel",
            details: [
                beszelError ?? "no data",
                "Check BESZEL_URL and the login. The user must be verified and have the read-only role.",
            ],
        });
    } else {
        const systems = metrics.systems.map((s) => s.name);
        checks.push({
            level: systems.length ? "ok" : "warn",
            title: `Beszel: ${systems.length} system(s) visible`,
            details: systems.length
                ? [list(systems)]
                : [
                      "Share systems with the fleet user, or set SHARE_ALL_SYSTEMS=true on the hub.",
                  ],
        });

        const coreName = config.core.beszel ?? fleet.core.name;
        const coreSystem = findSystem(metrics, coreName);
        checks.push(
            coreSystem
                ? {
                      level: "ok",
                      title: `${fleet.core.name} uses Beszel system "${coreSystem.name}"`,
                  }
                : {
                      level: "warn",
                      title: `no Beszel system named "${coreName}" for ${fleet.core.name}`,
                      details: [
                          "Rename the system in Beszel, or set core.beszel in the config.",
                      ],
                  }
        );

        const unmatched = config.machines.filter(
            (m) => !findSystem(metrics, m.beszel ?? m.name ?? m.id)
        );
        if (unmatched.length) {
            checks.push({
                level: "warn",
                title: `machines without a Beszel system: ${list(unmatched.map((m) => m.name ?? m.id))}`,
                details: [
                    'They show as "no signal". Add them in Beszel, or set beszel on the machine.',
                ],
            });
        }

        const measured = fleet.projects.filter((p) => p.cpu !== null).length;
        checks.push({
            level: measured || !coreSystem ? "ok" : "warn",
            title: `container metrics for ${measured}/${fleet.projects.length} projects`,
        });
    }

    const unsafe = strings(fleet).filter((text) => !isSafeText(text));
    checks.push(
        unsafe.length
            ? {
                  level: "fail",
                  title: "public data contains something that looks like an IP, port or version",
                  details: ["Please report this as a bug."],
              }
            : {
                  level: "ok",
                  title: "public data has no IPs, ports or versions",
              }
    );

    return checks;
}

const MARK: Record<Level, string> = {
    ok: "✓",
    warn: "!",
    fail: "✗",
    info: "·",
};

export function formatChecks(checks: Check[]): string {
    return checks
        .flatMap((c) => [
            `${MARK[c.level]} ${c.title}`,
            ...(c.details ?? []).map((d) => `    ${d}`),
        ])
        .join("\n");
}

if (import.meta.main) {
    console.log(`fleet ${pkg.version} doctor\n`);
    let checks: Check[];
    try {
        checks = await runDoctor(readRuntime());
    } catch (error) {
        checks = [{ level: "fail", title: reason(error) }];
    }
    console.log(formatChecks(checks));
    const failed = checks.some((c) => c.level === "fail");
    console.log(failed ? "\nSome checks failed." : "\nAll good.");
    process.exit(failed ? 1 : 0);
}
