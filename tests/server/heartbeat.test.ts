// @vitest-environment node
import { parseConfig } from "../../server/config";
import { createHeartbeats } from "../../server/heartbeat";
import { createApi } from "../../server/index";

import { describe, expect, it } from "vitest";

import type { Fleet, FleetNode } from "@/validators/fleet";

const TOKEN = "a-long-random-token";

const config = parseConfig({
    machines: [
        { id: "jane", role: "phone", heartbeat: 600 },
        { id: "bean", role: "laptop" },
    ],
});

const machine = (id: string): FleetNode => ({
    id: `machine-${id}`,
    name: id,
    kind: "machine",
    role: "machine",
    description: "",
    status: "unknown",
    cpu: null,
    ram: null,
    url: null,
    uptime: null,
});

const fleet: Fleet = {
    updatedAt: 0,
    site: { title: "fleet", description: "" },
    core: { ...machine("core"), id: "core", kind: "core", status: "up" },
    projects: [],
    machines: [machine("jane"), machine("bean")],
};

function setup(token: string | null = TOKEN) {
    let time = 1_000_000;
    const heartbeats = createHeartbeats(config.machines, token, () => time);
    return {
        heartbeats,
        advance: (ms: number) => (time += ms),
        jane: () => heartbeats.apply(fleet).machines[0],
    };
}

const beat = (
    id: string,
    init: {
        body?: string;
        token?: string;
        method?: string;
        query?: string;
    } = {}
) =>
    new Request(`http://localhost/api/heartbeat/${id}${init.query ?? ""}`, {
        method: init.method ?? "POST",
        headers: { Authorization: `Bearer ${init.token ?? TOKEN}` },
        body: init.body,
    });

describe("heartbeats", () => {
    it("accepts a heartbeat and marks the machine up", async () => {
        const { heartbeats, jane } = setup();
        const res = await heartbeats.handle(beat("jane"), "jane");
        expect(res.status).toBe(204);
        expect(jane()).toMatchObject({ status: "up", battery: null });
    });

    it("reads battery from a JSON body or the query", async () => {
        const { heartbeats, jane } = setup();
        await heartbeats.handle(
            beat("jane", { body: '{"battery": "82"}' }),
            "jane"
        );
        expect(jane().battery).toBe(82);
        await heartbeats.handle(beat("jane", { query: "?battery=40" }), "jane");
        expect(jane().battery).toBe(40);
    });

    it("rejects a bad battery or body", async () => {
        const { heartbeats } = setup();
        const bad = await heartbeats.handle(
            beat("jane", { body: '{"battery": 140}' }),
            "jane"
        );
        expect(bad.status).toBe(400);
        const notJson = await heartbeats.handle(
            beat("jane", { body: "hello" }),
            "jane"
        );
        expect(notJson.status).toBe(400);
    });

    it("goes offline after the timeout", async () => {
        const { heartbeats, advance, jane } = setup();
        await heartbeats.handle(beat("jane", { query: "?battery=50" }), "jane");
        advance(600_000);
        expect(jane().status).toBe("up");
        advance(1);
        expect(jane()).toMatchObject({ status: "down", battery: null });
    });

    it("leaves machines alone until they check in", () => {
        const { heartbeats } = setup();
        expect(heartbeats.apply(fleet)).toBe(fleet);
    });

    it("needs the right token before anything else", async () => {
        const { heartbeats } = setup();
        const wrong = await heartbeats.handle(
            beat("nope", { token: "guess" }),
            "nope"
        );
        expect(wrong.status).toBe(401);
        const missing = await heartbeats.handle(
            new Request("http://localhost/api/heartbeat/jane", {
                method: "POST",
            }),
            "jane"
        );
        expect(missing.status).toBe(401);
    });

    it("only takes heartbeats for machines that have them on", async () => {
        const { heartbeats } = setup();
        expect((await heartbeats.handle(beat("bean"), "bean")).status).toBe(
            404
        );
        expect((await heartbeats.handle(beat("nope"), "nope")).status).toBe(
            404
        );
    });

    it("only accepts POST", async () => {
        const { heartbeats } = setup();
        const res = await heartbeats.handle(
            beat("jane", { method: "GET" }),
            "jane"
        );
        expect(res.status).toBe(405);
    });

    it("is off without a token", async () => {
        const { heartbeats } = setup(null);
        expect((await heartbeats.handle(beat("jane"), "jane")).status).toBe(
            503
        );
    });

    it("shows heartbeats in /api/fleet", async () => {
        const { heartbeats } = setup();
        const handle = createApi(async () => fleet, heartbeats);
        await handle(beat("jane", { query: "?battery=77" }));
        const res = await handle(new Request("http://localhost/api/fleet"));
        const body = (await res?.json()) as Fleet;
        expect(body.machines[0]).toMatchObject({ status: "up", battery: 77 });
        expect(body.machines[1].status).toBe("unknown");
    });
});
