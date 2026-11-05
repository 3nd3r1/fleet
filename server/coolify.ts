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

const appSchema = z.object({
    uuid: z.string(),
    name: z.string(),
    status: z.string().nullish(),
    description: z.string().nullish(),
    fqdn: z.string().nullish(),
});

const serviceSchema = appSchema.extend({
    // A service's domains live on the containers inside it.
    applications: z
        .array(z.object({ name: z.string(), fqdn: z.string().nullish() }))
        .nullish(),
});

const databaseSchema = appSchema.omit({ fqdn: true });

export type CoolifyServer = z.infer<typeof serverSchema>;

export interface CoolifyDomain {
    // Name of the app or container the domain belongs to.
    name: string;
    url: string;
}

export interface CoolifyResource {
    uuid: string;
    name: string;
    status?: string | null;
    description?: string | null;
    type: "app" | "service" | "db";
    domains: CoolifyDomain[];
}

export interface CoolifySnapshot {
    servers: CoolifyServer[];
    resources: CoolifyResource[];
}

// Coolify stores several domains as one comma-separated string.
function splitDomains(name: string, fqdn: string | null | undefined) {
    return (fqdn ?? "")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => ({ name, url }));
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
        get("/applications", appSchema),
        get("/services", serviceSchema),
        get("/databases", databaseSchema),
    ]);

    const base_ = (r: z.infer<typeof databaseSchema>) => ({
        uuid: r.uuid,
        name: r.name,
        status: r.status,
        description: r.description,
    });

    return {
        servers,
        resources: [
            ...apps.map((r) => ({
                ...base_(r),
                type: "app" as const,
                domains: splitDomains(r.name, r.fqdn),
            })),
            ...services.map((r) => ({
                ...base_(r),
                type: "service" as const,
                domains: (r.applications ?? []).flatMap((a) =>
                    splitDomains(a.name, a.fqdn)
                ),
            })),
            ...dbs.map((r) => ({
                ...base_(r),
                type: "db" as const,
                domains: [],
            })),
        ],
    };
}
