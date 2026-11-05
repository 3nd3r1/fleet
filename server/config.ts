import { type FleetConfig, fleetConfigSchema } from "../src/validators/config";

import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

export function parseConfig(input: unknown): FleetConfig {
    const result = fleetConfigSchema.safeParse(input);
    if (!result.success) {
        throw new Error(
            `Invalid fleet config:\n${z.prettifyError(result.error)}`
        );
    }
    return result.data;
}

function parseJson(text: string, from: string): unknown {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(
            `Could not read ${from}: ${error instanceof Error ? error.message : error}`,
            { cause: error }
        );
    }
}

export interface LoadedConfig {
    config: FleetConfig;
    // Where the config came from, for logs and the doctor command.
    source: string;
}

type Env = Record<string, string | undefined>;

// Looks for config in this order:
// 1. FLEET_CONFIG_JSON: the config itself, handy for Coolify env vars
// 2. FLEET_CONFIG: path to a file (it must exist)
// 3. fleet.config.json in the working directory
// 4. nothing: all defaults
export function loadConfig(env: Env = process.env): LoadedConfig {
    if (env.FLEET_CONFIG_JSON?.trim()) {
        return {
            config: parseConfig(
                parseJson(env.FLEET_CONFIG_JSON, "FLEET_CONFIG_JSON")
            ),
            source: "FLEET_CONFIG_JSON",
        };
    }

    const file = env.FLEET_CONFIG ?? "fleet.config.json";
    if (!existsSync(file)) {
        if (env.FLEET_CONFIG) {
            throw new Error(`FLEET_CONFIG file not found: ${file}`);
        }
        return {
            config: parseConfig({}),
            source: "defaults (no config found)",
        };
    }
    return {
        config: parseConfig(parseJson(readFileSync(file, "utf8"), file)),
        source: file,
    };
}
