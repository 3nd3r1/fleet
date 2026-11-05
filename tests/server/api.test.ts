// @vitest-environment node
import { handleApi } from "../../server/index";

import { describe, expect, it } from "vitest";

describe("handleApi", () => {
    it("returns pong on /api/ping", async () => {
        const res = handleApi(new Request("http://localhost/api/ping"));
        expect(res?.status).toBe(200);
        expect(await res?.json()).toEqual({ message: "pong" });
    });

    it("returns 404 for unknown api routes", () => {
        const res = handleApi(new Request("http://localhost/api/nope"));
        expect(res?.status).toBe(404);
    });

    it("ignores non-api paths", () => {
        expect(handleApi(new Request("http://localhost/"))).toBeUndefined();
    });
});
