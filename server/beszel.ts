import { z } from "zod";

// Only the fields fleet uses. Host, port, hostname, kernel and agent version
// are never parsed, so they can't reach the page.
const systemSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    info: z
        .object({
            cpu: z.number().optional(),
            mp: z.number().optional(),
            u: z.number().optional(),
        })
        .nullish(),
});

const containerStatsSchema = z.object({
    stats: z.array(z.object({ n: z.string(), c: z.number(), m: z.number() })),
});

const systemStatsSchema = z.object({
    // Total memory in GB.
    stats: z.object({ m: z.number() }),
});

const listSchema = <T extends z.ZodType>(item: T) =>
    z.object({ items: z.array(item) });

export interface BeszelContainer {
    name: string;
    cpu: number;
    memoryMb: number;
}

export interface BeszelSystem {
    name: string;
    status: string;
    cpu: number | null;
    ram: number | null;
    uptime: number | null;
    memoryMb: number | null;
    containers: BeszelContainer[];
}

export interface BeszelSnapshot {
    systems: BeszelSystem[];
}

export function createBeszel(
    baseUrl: string,
    email: string,
    password: string,
    fetcher: typeof fetch = fetch
) {
    const base = baseUrl.replace(/\/$/, "");
    let token: string | null = null;

    async function login(): Promise<string> {
        const res = await fetcher(
            `${base}/api/collections/users/auth-with-password`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identity: email, password }),
                signal: AbortSignal.timeout(10_000),
            }
        );
        if (!res.ok) throw new Error(`beszel login returned ${res.status}`);
        const body = z.object({ token: z.string() }).parse(await res.json());
        return body.token;
    }

    async function get<T extends z.ZodType>(
        path: string,
        schema: T,
        retry = true
    ): Promise<z.infer<T>> {
        token ??= await login();
        const res = await fetcher(`${base}${path}`, {
            headers: { Authorization: token },
            signal: AbortSignal.timeout(10_000),
        });
        // Tokens expire. Log in again once, then give up.
        if ((res.status === 401 || res.status === 403) && retry) {
            token = null;
            return get(path, schema, false);
        }
        if (!res.ok)
            throw new Error(
                `beszel ${path.split("?")[0]} returned ${res.status}`
            );
        return schema.parse(await res.json());
    }

    const latest = (collection: string, systemId: string) =>
        `/api/collections/${collection}/records?perPage=1&sort=-created&filter=${encodeURIComponent(
            `system='${systemId.replace(/'/g, "")}'`
        )}`;

    return async function fetchBeszel(): Promise<BeszelSnapshot> {
        const { items } = await get(
            "/api/collections/systems/records?perPage=200",
            listSchema(systemSchema)
        );
        const systems = await Promise.all(
            items.map(async (system): Promise<BeszelSystem> => {
                const up = system.status === "up";
                const [containers, stats] = up
                    ? await Promise.all([
                          get(
                              latest("container_stats", system.id),
                              listSchema(containerStatsSchema)
                          ),
                          get(
                              latest("system_stats", system.id),
                              listSchema(systemStatsSchema)
                          ),
                      ])
                    : [null, null];
                const totalGb = stats?.items[0]?.stats.m;
                return {
                    name: system.name,
                    status: system.status,
                    cpu: up ? (system.info?.cpu ?? null) : null,
                    ram: up ? (system.info?.mp ?? null) : null,
                    uptime: up ? (system.info?.u ?? null) : null,
                    memoryMb: totalGb ? totalGb * 1024 : null,
                    containers: (containers?.items[0]?.stats ?? []).map(
                        (c) => ({
                            name: c.n,
                            cpu: c.c,
                            memoryMb: c.m,
                        })
                    ),
                };
            })
        );
        return { systems };
    };
}
