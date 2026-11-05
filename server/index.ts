import type { Fleet, Site } from "../src/validators/fleet";

import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { createFleetCache } from "./fleet";
import { createLoader, readRuntime } from "./runtime";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));

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

const ESCAPES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Puts the configured title and description into index.html, so link
// previews and the browser tab show them before any JavaScript runs.
export function renderIndex(
    html: string,
    site: Site & { intro?: boolean }
): string {
    const intro = site.intro === false ? "off" : "on";
    return html
        .replace(/<html([^>]*)>/, `<html$1 data-intro="${intro}">`)
        .replace(
            /<title>[^<]*<\/title>/,
            `<title>${escapeHtml(site.title)}</title>`
        )
        .replace(
            /(<meta\s+name="description"\s+content=")[^"]*(")/,
            `$1${escapeHtml(site.description)}$2`
        );
}

async function serveStatic(req: Request, index: string): Promise<Response> {
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
    return new Response(index, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
        },
    });
}

if (import.meta.main) {
    const runtime = readRuntime();
    console.log(`config: ${runtime.source}`);
    if (!runtime.coolify) console.warn("COOLIFY_URL or COOLIFY_TOKEN not set");
    if (!runtime.fetchBeszel) console.warn("Beszel not configured, no metrics");

    const load = createLoader(runtime);
    const getFleet = load ? createFleetCache(load, runtime.cacheMs) : null;

    const indexFile = Bun.file(join(DIST, "index.html"));
    const index = (await indexFile.exists())
        ? renderIndex(await indexFile.text(), runtime.config.site)
        : "Build the page first: bun run build";

    const handleApi = createApi(getFleet);
    Bun.serve({
        port: runtime.port,
        fetch: async (req) => (await handleApi(req)) ?? serveStatic(req, index),
    });
    console.log(`fleet listening on :${runtime.port}`);
}
