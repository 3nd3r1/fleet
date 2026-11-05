// @vitest-environment node
import { createBeszel } from "../../server/beszel";

import { describe, expect, it, vi } from "vitest";

function hub(options: { expireFirst?: boolean } = {}) {
    let logins = 0;
    let expired = options.expireFirst ?? false;
    const fetcher = vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("auth-with-password")) {
            logins++;
            return Response.json({
                token: `t${logins}`,
                record: { role: "readonly" },
            });
        }
        if (expired) {
            expired = false;
            return new Response("expired", { status: 401 });
        }
        if (url.includes("/systems/records")) {
            return Response.json({
                items: [
                    {
                        id: "sys1",
                        name: "Eros",
                        status: "up",
                        host: "10.0.0.5",
                        port: "45876",
                        info: {
                            cpu: 33.8,
                            mp: 56.6,
                            u: 1689275,
                            h: "eros-host",
                            k: "6.8.0",
                            v: "0.12.0",
                        },
                    },
                    {
                        id: "sys2",
                        name: "bean",
                        status: "down",
                        host: "10.0.0.6",
                        info: {},
                    },
                ],
            });
        }
        if (url.includes("/container_stats/")) {
            return Response.json({
                items: [
                    { stats: [{ n: "abc123-456", c: 2.5, m: 512, b: [1, 2] }] },
                ],
            });
        }
        if (url.includes("/system_stats/")) {
            return Response.json({
                items: [{ stats: { m: 8, mu: 4, cpu: 30 } }],
            });
        }
        return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    return { fetcher, logins: () => logins };
}

describe("createBeszel", () => {
    it("reads systems, containers and total memory", async () => {
        const { fetcher } = hub();
        const snapshot = await createBeszel("https://hub", "e", "p", fetcher)();
        const eros = snapshot.systems[0];
        expect(eros).toMatchObject({
            name: "Eros",
            status: "up",
            cpu: 33.8,
            ram: 56.6,
            uptime: 1689275,
            memoryMb: 8192,
        });
        expect(eros.containers).toEqual([
            { name: "abc123-456", cpu: 2.5, memoryMb: 512 },
        ]);
    });

    it("drops host, hostname, kernel and versions", async () => {
        const { fetcher } = hub();
        const text = JSON.stringify(
            await createBeszel("https://hub", "e", "p", fetcher)()
        );
        for (const secret of [
            "10.0.0.5",
            "45876",
            "eros-host",
            "6.8.0",
            "0.12.0",
        ]) {
            expect(text).not.toContain(secret);
        }
    });

    it("has no metrics for systems that are down", async () => {
        const { fetcher } = hub();
        const snapshot = await createBeszel("https://hub", "e", "p", fetcher)();
        expect(snapshot.systems[1]).toMatchObject({
            status: "down",
            cpu: null,
            ram: null,
            containers: [],
        });
    });

    it("logs in once and reuses the token", async () => {
        const h = hub();
        const fetchBeszel = createBeszel("https://hub", "e", "p", h.fetcher);
        await fetchBeszel();
        await fetchBeszel();
        expect(h.logins()).toBe(1);
    });

    it("logs in again when the token expires", async () => {
        const h = hub({ expireFirst: true });
        await createBeszel("https://hub", "e", "p", h.fetcher)();
        expect(h.logins()).toBe(2);
    });

    it("throws when the login fails", async () => {
        const fetcher = (async () =>
            new Response("no", { status: 400 })) as unknown as typeof fetch;
        await expect(
            createBeszel("https://hub", "e", "p", fetcher)()
        ).rejects.toThrow("login returned 400");
    });
});
