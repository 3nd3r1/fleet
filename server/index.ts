import type { Fleet } from "../src/validators/fleet";

import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchCoolify } from "./coolify";
import { buildFleet, createFleetCache } from "./fleet";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

export function createApi(getFleet: (() => Promise<Fleet>) | null) {
    return async function handleApi(
        req: Request
    ): Promise<Response | undefined> {
        const { pathname } = new URL(req.url);
        if (!pathname.startsWith("/api/")) return undefined;

        if (pathname === "/api/ping") return Response.json({ message: "pong" });

        if (pathname === "/api/fleet") {
            if (!getFleet) {
                return Response.json(
                    { error: "fleet source not configured" },
                    { status: 503 }
                );
            }
            try {
                return Response.json(await getFleet(), {
                    headers: { "Cache-Control": "no-store" },
                });
            } catch (error) {
                // Log the reason, but never send upstream details to the browser.
                console.error(
                    "fleet:",
                    error instanceof Error ? error.message : error
                );
                return Response.json(
                    { error: "upstream unavailable" },
                    { status: 502 }
                );
            }
        }

        return Response.json({ error: "not found" }, { status: 404 });
    };
}

async function serveStatic(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    const path = normalize(join(DIST, decodeURIComponent(pathname)));
    if (!path.startsWith(DIST))
        return new Response("Not found", { status: 404 });

    const file = Bun.file(path);
    if (pathname !== "/" && (await file.exists())) {
        const immutable = pathname.startsWith("/assets/");
        return new Response(file, {
            headers: {
                "Cache-Control": immutable
                    ? "public, max-age=31536000, immutable"
                    : "public, max-age=3600",
            },
        });
    }
    return new Response(Bun.file(join(DIST, "index.html")), {
        headers: { "Cache-Control": "no-cache" },
    });
}

if (import.meta.main) {
    const url = process.env.COOLIFY_URL;
    const token = process.env.COOLIFY_TOKEN;
    const getFleet =
        url && token
            ? createFleetCache(async () =>
                  buildFleet(await fetchCoolify(url, token), Date.now())
              )
            : null;
    if (!getFleet) console.warn("COOLIFY_URL or COOLIFY_TOKEN not set");

    const handleApi = createApi(getFleet);
    Bun.serve({
        port: PORT,
        fetch: async (req) => (await handleApi(req)) ?? serveStatic(req),
    });
    console.log(`fleet listening on :${PORT}`);
}
