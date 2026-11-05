import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

export function handleApi(req: Request): Response | undefined {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/ping") return Response.json({ message: "pong" });
    if (pathname.startsWith("/api/")) {
        return Response.json({ error: "not found" }, { status: 404 });
    }
    return undefined;
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

export function handle(req: Request): Response | Promise<Response> {
    return handleApi(req) ?? serveStatic(req);
}

if (import.meta.main) {
    Bun.serve({ port: PORT, fetch: handle });
    console.log(`fleet listening on :${PORT}`);
}
