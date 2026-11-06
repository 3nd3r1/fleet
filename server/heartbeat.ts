import type { FleetConfig } from "../src/validators/config";
import type { Fleet } from "../src/validators/fleet";

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// Machines that can't run a Beszel agent, like a phone, check in with
// POST /api/heartbeat/<id> every few minutes. They're up while heartbeats
// arrive and offline once they stop. Heartbeats live in memory only: after a
// restart a machine keeps its Beszel status (or "no signal") until it checks
// in again.

interface Beat {
    at: number;
    battery: number | null;
}

// Apps send battery as a number or a string. An empty value means none.
const battery = z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().min(0).max(100).optional()
);

const bodySchema = z.object({ battery });

const MAX_BODY = 1024;

const digest = (text: string) => createHash("sha256").update(text).digest();

const error = (status: number, message: string, headers?: HeadersInit) =>
    Response.json({ error: message }, { status, headers });

export function createHeartbeats(
    machines: FleetConfig["machines"],
    token: string | null,
    now: () => number = Date.now
) {
    const timeouts = new Map(
        machines.flatMap((m) =>
            m.heartbeat ? [[m.id, m.heartbeat * 1000] as const] : []
        )
    );
    const beats = new Map<string, Beat>();
    const expected = token ? digest(token) : null;

    // Hashing first makes the comparison constant-time for any length.
    function authorized(req: Request): boolean {
        const header = req.headers.get("authorization") ?? "";
        const given = header.replace(/^Bearer\s+/i, "");
        return (
            !!expected && !!given && timingSafeEqual(digest(given), expected)
        );
    }

    async function readBattery(
        req: Request,
        url: URL
    ): Promise<{ error: string } | { battery: number | null }> {
        const text = await req.text();
        if (text.length > MAX_BODY) return { error: "body too large" };
        let input: unknown = { battery: url.searchParams.get("battery") };
        if (text.trim()) {
            try {
                input = JSON.parse(text);
            } catch {
                return { error: "body must be JSON" };
            }
        }
        const parsed = bodySchema.safeParse(input);
        if (!parsed.success) return { error: "battery must be 0 to 100" };
        return { battery: parsed.data.battery ?? null };
    }

    async function handle(req: Request, id: string): Promise<Response> {
        if (!expected) return error(503, "heartbeat not configured");
        if (req.method !== "POST") {
            return error(405, "use POST", { Allow: "POST" });
        }
        // Check the token before anything else, so the machine list can't be
        // probed without it.
        if (!authorized(req)) return error(401, "bad token");
        if (!timeouts.has(id)) return error(404, "unknown machine");

        const result = await readBattery(req, new URL(req.url));
        if ("error" in result) return error(400, result.error);

        beats.set(id, { at: now(), battery: result.battery });
        return new Response(null, { status: 204 });
    }

    // Runs on every /api/fleet response, after the cache, so a heartbeat
    // shows up on the next poll.
    function apply(fleet: Fleet): Fleet {
        if (beats.size === 0) return fleet;
        return {
            ...fleet,
            machines: fleet.machines.map((node) => {
                const id = node.id.replace(/^machine-/, "");
                const timeout = timeouts.get(id);
                const beat = beats.get(id);
                if (!timeout || !beat) return node;
                return now() - beat.at <= timeout
                    ? { ...node, status: "up", battery: beat.battery }
                    : {
                          ...node,
                          status: "down",
                          cpu: null,
                          ram: null,
                          uptime: null,
                          battery: null,
                      };
            }),
        };
    }

    return { handle, apply };
}

export type Heartbeats = ReturnType<typeof createHeartbeats>;
