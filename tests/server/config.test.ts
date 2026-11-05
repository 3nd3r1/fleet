// @vitest-environment node
import { loadConfig, parseConfig } from "../../server/config";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_SUFFIXES } from "@/validators/config";

const write = (content: string) => {
    const dir = mkdtempSync(join(tmpdir(), "fleet-config-"));
    const file = join(dir, "fleet.config.json");
    writeFileSync(file, content);
    return file;
};

describe("parseConfig", () => {
    it("fills in defaults for an empty config", () => {
        const config = parseConfig({});
        expect(config.site).toMatchObject({ title: "fleet", intro: true });
        expect(config.core.name).toBeUndefined();
        expect(config.grouping.suffixes).toEqual(DEFAULT_SUFFIXES);
        expect(config.projects).toEqual({});
        expect(config.machines).toEqual([]);
    });

    it("rejects unknown keys with a readable error", () => {
        expect(() => parseConfig({ sight: {} })).toThrow(
            /Invalid fleet config/
        );
    });

    it("rejects non-https project links", () => {
        expect(() =>
            parseConfig({
                projects: { blog: { url: "http://blog.example.com" } },
            })
        ).toThrow();
    });

    it("accepts false to turn a link off", () => {
        const config = parseConfig({ projects: { blog: { url: false } } });
        expect(config.projects.blog.url).toBe(false);
    });
});

describe("loadConfig", () => {
    it("reads FLEET_CONFIG_JSON first", () => {
        const loaded = loadConfig({
            FLEET_CONFIG_JSON: '{ "site": { "title": "inline" } }',
            FLEET_CONFIG: write('{ "site": { "title": "file" } }'),
        });
        expect(loaded.config.site.title).toBe("inline");
        expect(loaded.source).toBe("FLEET_CONFIG_JSON");
    });

    it("reads the FLEET_CONFIG file", () => {
        const file = write('{ "site": { "title": "my fleet" } }');
        const loaded = loadConfig({ FLEET_CONFIG: file });
        expect(loaded.config.site.title).toBe("my fleet");
        expect(loaded.source).toBe(file);
    });

    it("parses the example and the eros config", () => {
        for (const file of [
            "fleet.config.example.json",
            "deploy/eros.ender.fi.json",
        ]) {
            expect(() => loadConfig({ FLEET_CONFIG: file })).not.toThrow();
        }
    });

    it("errors on a missing FLEET_CONFIG file", () => {
        expect(() =>
            loadConfig({ FLEET_CONFIG: "/nope/fleet.config.json" })
        ).toThrow(/not found/);
    });

    it("errors on broken JSON in a file or the env var", () => {
        expect(() => loadConfig({ FLEET_CONFIG: write("{ nope") })).toThrow(
            /Could not read/
        );
        expect(() => loadConfig({ FLEET_CONFIG_JSON: "{ nope" })).toThrow(
            /FLEET_CONFIG_JSON/
        );
    });
});
