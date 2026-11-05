// @vitest-environment node
import type { BeszelSnapshot } from "../../server/beszel";
import { parseConfig } from "../../server/config";
import {
    type CoolifyResource,
    type CoolifySnapshot,
    fetchCoolify,
} from "../../server/coolify";
import {
    buildFleet,
    createFleetCache,
    findSystem,
    isSafeText,
    machineStatus,
    projectName,
    publicUrl,
    resourceStatus,
    safeUrl,
    worstStatus,
} from "../../server/fleet";

import { describe, expect, it, vi } from "vitest";

import { fleetSchema } from "@/validators/fleet";

const defaults = parseConfig({});

const resource = (
    name: string,
    status: string,
    type: CoolifyResource["type"] = "app",
    extra: Partial<CoolifyResource> = {}
): CoolifyResource => ({
    uuid: name,
    name,
    status,
    type,
    domains: [],
    ...extra,
});

const snapshot: CoolifySnapshot = {
    servers: [
        {
            uuid: "s1",
            name: "localhost",
            is_coolify_host: true,
            is_reachable: true,
            is_usable: true,
        },
    ],
    resources: [
        resource("bloglist-frontend", "running:unknown", "app", {
            domains: [
                { name: "bloglist-frontend", url: "https://blog.example.com" },
            ],
        }),
        resource("bloglist-backend", "exited:unhealthy", "app", {
            domains: [
                {
                    name: "bloglist-backend",
                    url: "https://api.blog.example.com",
                },
            ],
        }),
        resource("thrivy-page", "running:healthy"),
        resource("thrivy-database", "running:healthy", "db"),
        resource("nextcloud", "running:healthy", "service", {
            description: "Runs on 10.0.0.5:8080 with v1.2.3",
            domains: [{ name: "nextcloud", url: "https://drive.example.com" }],
        }),
        resource("monitor", "running:healthy", "service", {
            domains: [
                {
                    name: "monitor",
                    url: "http://monitor-abc.10.0.0.5.sslip.io:8090",
                },
            ],
        }),
    ],
};

describe("projectName", () => {
    const name = (n: string) => projectName(n, defaults.grouping);

    it("groups frontends, backends, pages and databases", () => {
        expect(name("bloglist-frontend")).toBe("bloglist");
        expect(name("bloglist-backend")).toBe("bloglist");
        expect(name("thrivy-page")).toBe("thrivy");
        expect(name("timescaledb-tune-ui")).toBe("timescaledb-tune");
        expect(name("commute-ai/ai-agents")).toBe("commute-ai");
        expect(name("commute-ai-backend-database")).toBe("commute-ai");
    });

    it("leaves plain names alone", () => {
        expect(name("nextcloud")).toBe("nextcloud");
        expect(name("ender-homepage")).toBe("ender-homepage");
    });

    it("uses configured suffixes and aliases", () => {
        const grouping = parseConfig({
            grouping: { suffixes: ["svc"], aliases: { legacy: "blog" } },
        }).grouping;
        expect(projectName("shop-svc", grouping)).toBe("shop");
        expect(projectName("shop-frontend", grouping)).toBe("shop-frontend");
        expect(projectName("legacy", grouping)).toBe("blog");
    });
});

describe("resourceStatus", () => {
    it("maps Coolify statuses", () => {
        expect(resourceStatus("running:healthy")).toBe("up");
        expect(resourceStatus("running:unknown")).toBe("up");
        expect(resourceStatus("running:unhealthy")).toBe("degraded");
        expect(resourceStatus("restarting")).toBe("degraded");
        expect(resourceStatus("exited:unhealthy")).toBe("down");
        expect(resourceStatus(null)).toBe("down");
    });
});

describe("worstStatus", () => {
    it("picks the most severe status", () => {
        expect(worstStatus(["up", "degraded"])).toBe("degraded");
        expect(worstStatus(["up", "down", "degraded"])).toBe("down");
        expect(worstStatus([])).toBe("up");
    });
});

describe("isSafeText", () => {
    it("rejects IPs, ports and versions", () => {
        expect(isSafeText("10.0.0.5")).toBe(false);
        expect(isSafeText("listens on :8080")).toBe(false);
        expect(isSafeText("v1.2.3")).toBe(false);
        expect(isSafeText("Image board for friends.")).toBe(true);
    });
});

describe("safeUrl", () => {
    it("keeps plain https domains as their origin", () => {
        expect(safeUrl("https://blog.example.com/admin?x=1")).toBe(
            "https://blog.example.com"
        );
    });

    it("rejects http, ports, IPs and sslip hosts", () => {
        expect(safeUrl("http://blog.example.com")).toBeNull();
        expect(safeUrl("https://blog.example.com:8443")).toBeNull();
        expect(safeUrl("https://10.0.0.5")).toBeNull();
        expect(safeUrl("https://app.10.0.0.5.sslip.io")).toBeNull();
        expect(safeUrl("https://app.nip.io")).toBeNull();
        expect(safeUrl("not a url")).toBeNull();
    });
});

describe("publicUrl", () => {
    it("skips backends, APIs and agents", () => {
        expect(
            publicUrl([
                resource("x-backend", "running", "app", {
                    domains: [{ name: "x-backend", url: "https://api.x.com" }],
                }),
                resource("x", "running", "service", {
                    domains: [
                        { name: "x-agent", url: "https://agent.x.com" },
                        { name: "x", url: "https://x.com" },
                    ],
                }),
            ])
        ).toBe("https://x.com");
    });

    it("returns null when only internal domains exist", () => {
        expect(
            publicUrl([
                resource("x/backend", "running", "app", {
                    domains: [{ name: "x/backend", url: "https://api.x.com" }],
                }),
            ])
        ).toBeNull();
    });
});

describe("buildFleet", () => {
    const fleet = buildFleet(snapshot, defaults, 1000);
    const byId = (id: string) => fleet.projects.find((p) => p.id === id);

    it("matches the schema", () => {
        expect(fleetSchema.safeParse(fleet).success).toBe(true);
    });

    it("groups resources into projects with the worst status", () => {
        expect(byId("bloglist")?.status).toBe("down");
        expect(byId("bloglist")?.role).toBe("2 apps");
        expect(byId("thrivy")?.role).toBe("1 app · 1 db");
    });

    it("links the public domain, not the backend", () => {
        expect(byId("bloglist")?.url).toBe("https://blog.example.com");
    });

    it("never links an sslip address", () => {
        expect(byId("monitor")?.url).toBeNull();
    });

    it("drops descriptions with IPs, ports or versions", () => {
        expect(byId("nextcloud")?.description).toBe("");
    });

    it("never leaks IPs, ports or versions in any text", () => {
        const strings = (v: unknown): string[] =>
            typeof v === "string"
                ? [v]
                : v && typeof v === "object"
                  ? Object.values(v).flatMap(strings)
                  : [];
        for (const text of strings(fleet)) expect(isSafeText(text)).toBe(true);
    });

    it("uses defaults without a config", () => {
        expect(fleet.site.title).toBe("fleet");
        expect(fleet.core.name).toBe("server");
        expect(fleet.machines).toEqual([]);
    });

    it("applies project settings from the config", () => {
        const config = parseConfig({
            projects: {
                bloglist: {
                    name: "Blog",
                    description: "Where I write.",
                    url: false,
                },
                thrivy: { hidden: true },
                nextcloud: { url: "https://files.example.com" },
            },
        });
        const configured = buildFleet(snapshot, config, 1000);
        const blog = configured.projects.find((p) => p.id === "bloglist");
        expect(blog?.name).toBe("Blog");
        expect(blog?.description).toBe("Where I write.");
        expect(blog?.url).toBeNull();
        expect(configured.projects.some((p) => p.id === "thrivy")).toBe(false);
        expect(configured.projects.find((p) => p.id === "nextcloud")?.url).toBe(
            "https://files.example.com"
        );
    });

    it("takes site, core and machines from the config", () => {
        const config = parseConfig({
            site: { title: "my fleet" },
            core: { name: "mothership" },
            machines: [{ id: "laptop", role: "laptop" }],
        });
        const configured = buildFleet(snapshot, config, 1000);
        expect(configured.site.title).toBe("my fleet");
        expect(configured.core.name).toBe("mothership");
        expect(configured.machines).toHaveLength(1);
        expect(configured.machines[0].status).toBe("unknown");
    });

    it("marks the core down when the server is unreachable", () => {
        const down = buildFleet(
            {
                ...snapshot,
                servers: [{ ...snapshot.servers[0], is_reachable: false }],
            },
            defaults,
            1000
        );
        expect(down.core.status).toBe("down");
    });
});

describe("fetchCoolify", () => {
    it("keeps only whitelisted fields and reads service domains", async () => {
        const fetcher = vi.fn(async (url: string | URL | Request) => {
            const path = String(url);
            const body = path.endsWith("/servers")
                ? [
                      {
                          uuid: "s1",
                          name: "localhost",
                          ip: "10.0.0.5",
                          port: 22,
                          is_reachable: true,
                      },
                  ]
                : path.endsWith("/applications")
                  ? [
                        {
                            uuid: "a",
                            name: "thrivy-page",
                            status: "running:healthy",
                            fqdn: "https://thrivy.example.com,https://www.thrivy.example.com",
                            ports_exposes: "3000",
                            git_commit_sha: "abc",
                        },
                    ]
                  : path.endsWith("/services")
                    ? [
                          {
                              uuid: "s",
                              name: "nextcloud",
                              status: "running:healthy",
                              server: { ip: "10.0.0.5" },
                              applications: [
                                  {
                                      name: "nextcloud",
                                      fqdn: "https://drive.example.com",
                                  },
                              ],
                          },
                      ]
                    : [];
            return Response.json(body);
        }) as unknown as typeof fetch;

        const result = await fetchCoolify(
            "https://coolify.example/",
            "t",
            fetcher
        );
        const text = JSON.stringify(result);
        expect(text).not.toContain("10.0.0.5");
        expect(text).not.toContain("ports_exposes");
        expect(text).not.toContain("git_commit_sha");
        expect(result.resources[0].domains).toHaveLength(2);
        expect(result.resources[1].domains[0].url).toBe(
            "https://drive.example.com"
        );
    });

    it("throws on a bad response", async () => {
        const fetcher = (async () =>
            new Response("nope", { status: 401 })) as unknown as typeof fetch;
        await expect(fetchCoolify("https://c", "t", fetcher)).rejects.toThrow(
            "401"
        );
    });
});

describe("createFleetCache", () => {
    const fleet = buildFleet(snapshot, defaults, 1000);

    it("loads once within the ttl", async () => {
        const load = vi.fn(async () => fleet);
        let now = 0;
        const get = createFleetCache(load, 20_000, () => now);
        await get();
        now = 10_000;
        await get();
        expect(load).toHaveBeenCalledTimes(1);
        now = 25_000;
        await get();
        expect(load).toHaveBeenCalledTimes(2);
    });

    it("shares one request between concurrent callers", async () => {
        const load = vi.fn(async () => fleet);
        const get = createFleetCache(load);
        await Promise.all([get(), get(), get()]);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it("serves the last good value when loading fails", async () => {
        let now = 0;
        let fail = false;
        const get = createFleetCache(
            async () => {
                if (fail) throw new Error("down");
                return fleet;
            },
            20_000,
            () => now
        );
        await get();
        fail = true;
        now = 30_000;
        await expect(get()).resolves.toBe(fleet);
    });

    it("throws when there is nothing cached yet", async () => {
        const get = createFleetCache(async () => {
            throw new Error("down");
        });
        await expect(get()).rejects.toThrow("down");
    });
});

describe("beszel metrics", () => {
    const metrics: BeszelSnapshot = {
        systems: [
            {
                name: "Station",
                status: "up",
                cpu: 40,
                ram: 60,
                uptime: 1000.4,
                memoryMb: 8192,
                containers: [
                    { name: "bloglist-frontend-123", cpu: 1.5, memoryMb: 256 },
                    { name: "bloglist-backend-456", cpu: 2.5, memoryMb: 768 },
                    { name: "coolify-proxy", cpu: 0.5, memoryMb: 100 },
                ],
            },
            {
                name: "laptop",
                status: "up",
                cpu: 12,
                ram: 41,
                uptime: 500,
                memoryMb: 16384,
                containers: [],
            },
            {
                name: "work",
                status: "down",
                cpu: null,
                ram: null,
                uptime: null,
                memoryMb: null,
                containers: [],
            },
        ],
    };
    const config = parseConfig({
        core: { name: "station" },
        machines: [
            { id: "laptop" },
            { id: "work" },
            { id: "phone" },
            { id: "desk", beszel: "Laptop" },
        ],
    });
    const fleet = buildFleet(snapshot, config, 1000, metrics);

    it("matches systems by name, ignoring case", () => {
        expect(findSystem(metrics, "station")?.name).toBe("Station");
        expect(findSystem(metrics, "nope")).toBeNull();
        expect(findSystem(null, "station")).toBeNull();
    });

    it("gives the core its CPU, RAM and uptime", () => {
        expect(fleet.core).toMatchObject({ cpu: 40, ram: 60, uptime: 1000 });
    });

    it("sums a project's containers", () => {
        const blog = fleet.projects.find((p) => p.id === "bloglist");
        expect(blog?.cpu).toBe(4);
        expect(blog?.ram).toBe(12.5);
    });

    it("has no metrics for projects without containers", () => {
        expect(fleet.projects.find((p) => p.id === "thrivy")?.cpu).toBeNull();
    });

    it("maps machine statuses", () => {
        const byName = (name: string) =>
            fleet.machines.find((m) => m.name === name);
        expect(byName("laptop")).toMatchObject({ status: "up", cpu: 12 });
        expect(byName("work")).toMatchObject({ status: "down", cpu: null });
        expect(byName("phone")?.status).toBe("unknown");
        expect(byName("desk")?.status).toBe("up");
    });

    it("treats paused and pending as unknown", () => {
        const system = { ...metrics.systems[0], status: "paused" };
        expect(machineStatus(system)).toBe("unknown");
        expect(machineStatus({ ...system, status: "pending" })).toBe("unknown");
    });

    it("still matches the schema", () => {
        expect(fleetSchema.safeParse(fleet).success).toBe(true);
    });
});
