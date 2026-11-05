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
        expect(config.site.title).toBe("fleet");
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
    it("parses the example config", () => {
        expect(() => loadConfig("fleet.config.example.json")).not.toThrow();
    });

    it("parses the deployed config", () => {
        expect(() => loadConfig("fleet.config.json")).not.toThrow();
    });

    it("reads a config file", () => {
        const file = write('{ "site": { "title": "my fleet" } }');
        expect(loadConfig(file).site.title).toBe("my fleet");
    });

    it("errors on a missing FLEET_CONFIG file", () => {
        expect(() => loadConfig("/nope/fleet.config.json")).toThrow(
            /not found/
        );
    });

    it("errors on broken JSON", () => {
        expect(() => loadConfig(write("{ nope"))).toThrow(/Could not read/);
    });
});
