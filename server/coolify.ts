import { z } from "zod";

// Only the fields fleet uses. Zod drops every other key (IPs, ports,
// versions, settings), so nothing sensitive can pass through by accident.
const serverSchema = z.object({
    uuid: z.string(),
    name: z.string(),
    is_coolify_host: z.boolean().optional(),
    is_reachable: z.boolean().optional(),
    is_usable: z.boolean().optional(),
});

const resourceSchema = z.object({
    uuid: z.string(),
    name: z.string(),
    status: z.string().nullish(),
    description: z.string().nullish(),
});

export type CoolifyServer = z.infer<typeof serverSchema>;
export type CoolifyResource = z.infer<typeof resourceSchema> & {
    type: "app" | "service" | "db";
};

export interface CoolifySnapshot {
    servers: CoolifyServer[];
    resources: CoolifyResource[];
}

export async function fetchCoolify(
    baseUrl: string,
    token: string,
    fetcher: typeof fetch = fetch
): Promise<CoolifySnapshot> {
    const base = baseUrl.replace(/\/$/, "");
    async function get<T extends z.ZodType>(path: string, schema: T) {
        const res = await fetcher(`${base}/api/v1${path}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`coolify ${path} returned ${res.status}`);
        return z.array(schema).parse(await res.json());
    }

    const [servers, apps, services, dbs] = await Promise.all([
        get("/servers", serverSchema),
        get("/applications", resourceSchema),
        get("/services", resourceSchema),
        get("/databases", resourceSchema),
    ]);

    return {
        servers,
        resources: [
            ...apps.map((r) => ({ ...r, type: "app" as const })),
            ...services.map((r) => ({ ...r, type: "service" as const })),
            ...dbs.map((r) => ({ ...r, type: "db" as const })),
        ],
    };
}
