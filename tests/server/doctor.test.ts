// @vitest-environment node
import type { BeszelSnapshot } from "../../server/beszel";
import type { CoolifySnapshot } from "../../server/coolify";
import { formatChecks, runDoctor } from "../../server/doctor";
import { readRuntime } from "../../server/runtime";

import { describe, expect, it } from "vitest";

const snapshot: CoolifySnapshot = {
    servers: [{ uuid: "s", name: "localhost", is_coolify_host: true }],
    resources: [
        {
            uuid: "u1",
            name: "blog-frontend",
            status: "running:healthy",
            type: "app",
            domains: [
                { name: "blog-frontend", url: "https://blog.example.com" },
            ],
        },
        {
            uuid: "u2",
            name: "shop",
            status: "running:healthy",
            type: "app",
            domains: [],
        },
    ],
};

const metrics: BeszelSnapshot = {
    systems: [
        {
            name: "Station",
            status: "up",
            cpu: 10,
            ram: 20,
            uptime: 100,
            memoryMb: 1024,
            containers: [{ name: "u1-123", cpu: 1, memoryMb: 10 }],
        },
    ],
};

function runtime(config: object, env: Record<string, string> = {}) {
    return readRuntime({
        FLEET_CONFIG_JSON: JSON.stringify(config),
        COOLIFY_URL: "https://coolify.example",
        COOLIFY_TOKEN: "secret-token",
        ...env,
    });
}

const ok = async () => snapshot;

describe("runDoctor", () => {
    it("fails without Coolify settings", async () => {
        const checks = await runDoctor(
            readRuntime({ FLEET_CONFIG_JSON: "{}" })
        );
        expect(checks.at(-1)?.level).toBe("fail");
    });

    it("fails with a hint when Coolify can't be read", async () => {
        const checks = await runDoctor(runtime({}), async () => {
            throw new Error("coolify /servers returned 401");
        });
        const fail = checks.find((c) => c.level === "fail");
        expect(fail?.details?.[0]).toContain("401");
    });

    it("warns about config projects that don't exist", async () => {
        const checks = await runDoctor(
            runtime({ projects: { blgo: { description: "typo" } } }),
            ok
        );
        expect(
            checks.find((c) =>
                c.title.includes("projects that Coolify doesn't")
            )?.details?.[0]
        ).toBe("blgo");
    });

    it("reports projects without links and descriptions", async () => {
        const text = formatChecks(await runDoctor(runtime({}), ok));
        expect(text).toContain("no link: shop");
        expect(text).toContain("no description: blog, shop");
    });

    it("matches Beszel systems and reports missing machines", async () => {
        const r = runtime({
            core: { name: "station" },
            machines: [{ id: "laptop" }],
        });
        r.fetchBeszel = async () => metrics;
        const text = formatChecks(await runDoctor(r, ok));
        expect(text).toContain('station uses Beszel system "Station"');
        expect(text).toContain("machines without a Beszel system: laptop");
        expect(text).toContain("container metrics for 1/2 projects");
    });

    it("fails when Beszel can't be read", async () => {
        const r = runtime({});
        r.fetchBeszel = async () => {
            throw new Error("beszel login returned 400");
        };
        const checks = await runDoctor(r, ok);
        expect(checks.some((c) => c.title === "could not read Beszel")).toBe(
            true
        );
    });

    it("never prints the token", async () => {
        const text = formatChecks(await runDoctor(runtime({}), ok));
        expect(text).not.toContain("secret-token");
        expect(text).toContain("public data has no IPs, ports or versions");
    });
});
