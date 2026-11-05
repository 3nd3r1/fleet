// @vitest-environment node
import { createApi } from "../../server/index";

import { describe, expect, it } from "vitest";

import { createMock } from "@/lib/mock";

const req = (path: string) => new Request(`http://localhost${path}`);

describe("api", () => {
    it("returns pong on /api/ping", async () => {
        const res = await createApi(null)(req("/api/ping"));
        expect(res?.status).toBe(200);
        expect(await res?.json()).toEqual({ message: "pong" });
    });

    it("returns 404 for unknown api routes", async () => {
        const res = await createApi(null)(req("/api/nope"));
        expect(res?.status).toBe(404);
    });

    it("ignores non-api paths", async () => {
        expect(await createApi(null)(req("/"))).toBeUndefined();
    });

    it("returns 503 on /api/fleet when no source is configured", async () => {
        const res = await createApi(null)(req("/api/fleet"));
        expect(res?.status).toBe(503);
    });

    it("returns the fleet on /api/fleet", async () => {
        const fleet = createMock().next();
        const res = await createApi(async () => fleet)(req("/api/fleet"));
        expect(res?.status).toBe(200);
        expect(await res?.json()).toEqual(fleet);
    });

    it("hides upstream errors from the browser", async () => {
        const handle = createApi(async () => {
            throw new Error("coolify /servers returned 401 at secret-host");
        });
        const res = await handle(req("/api/fleet"));
        expect(res?.status).toBe(502);
        expect(JSON.stringify(await res?.json())).not.toContain("secret-host");
    });
});
