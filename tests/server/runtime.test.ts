// @vitest-environment node
import { createLoader, readRuntime } from "../../server/runtime";

import { describe, expect, it } from "vitest";

const base = { FLEET_CONFIG_JSON: "{}" };

describe("readRuntime", () => {
    it("needs both Coolify variables", () => {
        expect(
            readRuntime({ ...base, COOLIFY_URL: "https://c" }).coolify
        ).toBeNull();
        expect(
            readRuntime({
                ...base,
                COOLIFY_URL: "https://c",
                COOLIFY_TOKEN: "t",
            }).coolify
        ).toEqual({ url: "https://c", token: "t" });
    });

    it("needs all three Beszel variables", () => {
        expect(
            readRuntime({ ...base, BESZEL_URL: "https://b", BESZEL_EMAIL: "e" })
                .fetchBeszel
        ).toBeNull();
        expect(
            readRuntime({
                ...base,
                BESZEL_URL: "https://b",
                BESZEL_EMAIL: "e",
                BESZEL_PASSWORD: "p",
            }).fetchBeszel
        ).toBeTypeOf("function");
    });

    it("caches for 20 seconds by default and never under 5", () => {
        expect(readRuntime(base).cacheMs).toBe(20_000);
        expect(
            readRuntime({ ...base, FLEET_CACHE_SECONDS: "60" }).cacheMs
        ).toBe(60_000);
        expect(readRuntime({ ...base, FLEET_CACHE_SECONDS: "1" }).cacheMs).toBe(
            5_000
        );
        expect(
            readRuntime({ ...base, FLEET_CACHE_SECONDS: "soon" }).cacheMs
        ).toBe(20_000);
    });

    it("reads the port", () => {
        expect(readRuntime(base).port).toBe(3000);
        expect(readRuntime({ ...base, PORT: "8080" }).port).toBe(8080);
    });
});

describe("createLoader", () => {
    it("is null without Coolify", () => {
        expect(createLoader(readRuntime(base))).toBeNull();
    });
});
