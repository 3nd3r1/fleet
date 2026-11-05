// @vitest-environment node
import { type CoolifySnapshot, fetchCoolify } from "../../server/coolify";
import {
    buildFleet,
    createFleetCache,
    isSafeText,
    projectName,
    resourceStatus,
    worstStatus,
} from "../../server/fleet";

import { describe, expect, it, vi } from "vitest";

import { fleetSchema } from "@/validators/fleet";

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
        {
            uuid: "a",
            name: "bloglist-frontend",
            status: "running:unknown",
            type: "app",
        },
        {
            uuid: "b",
            name: "bloglist-backend",
            status: "exited:unhealthy",
            type: "app",
        },
        {
            uuid: "c",
            name: "thrivy-page",
            status: "running:healthy",
            type: "app",
        },
        {
            uuid: "d",
            name: "thrivy-database",
            status: "running:healthy",
            type: "db",
        },
        {
            uuid: "e",
            name: "nextcloud",
            status: "running:healthy",
            description: "Runs on 10.0.0.5:8080 with v1.2.3",
            type: "service",
        },
    ],
};

describe("projectName", () => {
    it("groups frontends, backends, pages and databases", () => {
        expect(projectName("bloglist-frontend")).toBe("bloglist");
        expect(projectName("bloglist-backend")).toBe("bloglist");
        expect(projectName("thrivy-page")).toBe("thrivy");
        expect(projectName("timescaledb-tune-ui")).toBe("timescaledb-tune");
        expect(projectName("commute-ai/ai-agents")).toBe("commute-ai");
        expect(projectName("commute-ai-backend-database")).toBe("commute-ai");
    });

    it("leaves plain names alone", () => {
        expect(projectName("nextcloud")).toBe("nextcloud");
        expect(projectName("ender-homepage")).toBe("ender-homepage");
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

describe("buildFleet", () => {
    const fleet = buildFleet(snapshot, 1000);

    it("matches the schema", () => {
        expect(fleetSchema.safeParse(fleet).success).toBe(true);
    });

    it("groups resources into projects with the worst status", () => {
        const bloglist = fleet.projects.find((p) => p.id === "bloglist");
        expect(bloglist?.status).toBe("down");
        expect(bloglist?.role).toBe("2 apps");
        expect(fleet.projects.find((p) => p.id === "thrivy")?.role).toBe(
            "1 app · 1 db"
        );
    });

    it("drops descriptions with IPs, ports or versions", () => {
        expect(
            fleet.projects.find((p) => p.id === "nextcloud")?.description
        ).toBe("");
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

    it("marks eros down when the server is unreachable", () => {
        const down = buildFleet(
            {
                ...snapshot,
                servers: [{ ...snapshot.servers[0], is_reachable: false }],
            },
            1000
        );
        expect(down.core.status).toBe("down");
    });

    it("has no metrics until Beszel is wired up", () => {
        expect(fleet.core.cpu).toBeNull();
        expect(fleet.machines.every((m) => m.status === "unknown")).toBe(true);
    });
});

describe("fetchCoolify", () => {
    it("keeps only whitelisted fields", async () => {
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
                            ports_exposes: "3000",
                            git_commit_sha: "abc",
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
        expect(result.resources).toHaveLength(1);
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
    const fleet = buildFleet(snapshot, 1000);

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
