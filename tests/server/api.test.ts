// @vitest-environment node
import { createApi, renderIndex } from "../../server/index";

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

describe("renderIndex", () => {
    const html = `<head>
        <title>fleet</title>
        <meta
            name="description"
            content="old"
        />
    </head>`;

    it("puts the configured title and description in", () => {
        const out = renderIndex(html, {
            title: "my fleet",
            description: "new",
        });
        expect(out).toContain("<title>my fleet</title>");
        expect(out).toContain('content="new"');
    });

    it("marks the intro as on or off", () => {
        const page = `<html lang="en">${html}</html>`;
        expect(renderIndex(page, { title: "t", description: "d" })).toContain(
            '<html lang="en" data-intro="on">'
        );
        expect(
            renderIndex(page, { title: "t", description: "d", intro: false })
        ).toContain('data-intro="off"');
    });

    it("escapes html", () => {
        const out = renderIndex(html, {
            title: "<script>x</script>",
            description: '"quoted"',
        });
        expect(out).not.toContain("<script>");
        expect(out).toContain("&quot;quoted&quot;");
    });
});
