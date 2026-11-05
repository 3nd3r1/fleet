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

// Reads FLEET_CONFIG, or fleet.config.json in the working directory. A missing
// default file is fine (all defaults). A missing FLEET_CONFIG file is an error.
export function loadConfig(path = process.env.FLEET_CONFIG): FleetConfig {
    const file = path ?? "fleet.config.json";
    if (!existsSync(file)) {
        if (path) throw new Error(`FLEET_CONFIG file not found: ${file}`);
        return parseConfig({});
    }
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
        throw new Error(
            `Could not read ${file}: ${error instanceof Error ? error.message : error}`,
            { cause: error }
        );
    }
    return parseConfig(raw);
}
