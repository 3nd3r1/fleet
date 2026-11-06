import type { Fleet } from "../src/validators/fleet";

import { type BeszelSnapshot, createBeszel } from "./beszel";
import { type LoadedConfig, loadConfig } from "./config";
import { fetchCoolify } from "./coolify";
import { buildFleet } from "./fleet";

type Env = Record<string, string | undefined>;

export interface Runtime extends LoadedConfig {
    port: number;
    cacheMs: number;
    coolify: { url: string; token: string } | null;
    fetchBeszel: (() => Promise<BeszelSnapshot>) | null;
    // Shared secret for POST /api/heartbeat/<machine>. null turns it off.
    heartbeatToken: string | null;
}

// Everything the server needs from the environment, read in one place.
export function readRuntime(env: Env = process.env): Runtime {
    const loaded = loadConfig(env);
    const cacheSeconds = Number(env.FLEET_CACHE_SECONDS ?? 20);
    const { BESZEL_URL, BESZEL_EMAIL, BESZEL_PASSWORD } = env;
    return {
        ...loaded,
        port: Number(env.PORT ?? 3000),
        // Never ask Coolify more often than every 5 seconds.
        cacheMs:
            Math.max(5, Number.isFinite(cacheSeconds) ? cacheSeconds : 20) *
            1000,
        coolify:
            env.COOLIFY_URL && env.COOLIFY_TOKEN
                ? { url: env.COOLIFY_URL, token: env.COOLIFY_TOKEN }
                : null,
        fetchBeszel:
            BESZEL_URL && BESZEL_EMAIL && BESZEL_PASSWORD
                ? createBeszel(BESZEL_URL, BESZEL_EMAIL, BESZEL_PASSWORD)
                : null,
        heartbeatToken: env.FLEET_HEARTBEAT_TOKEN?.trim() || null,
    };
}

const reason = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

// Builds the fleet from Coolify, plus Beszel metrics when configured.
// Metrics are optional: if Beszel fails, the map still shows statuses.
export function createLoader(runtime: Runtime): (() => Promise<Fleet>) | null {
    const { coolify, fetchBeszel, config } = runtime;
    if (!coolify) return null;

    const loadMetrics = async () => {
        if (!fetchBeszel) return null;
        try {
            return await fetchBeszel();
        } catch (error) {
            console.error("beszel:", reason(error));
            return null;
        }
    };

    return async () => {
        const [snapshot, metrics] = await Promise.all([
            fetchCoolify(coolify.url, coolify.token),
            loadMetrics(),
        ]);
        return buildFleet(snapshot, config, Date.now(), metrics);
    };
}
