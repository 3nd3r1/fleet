import { z } from "zod";

// The page's CSP blocks eval. Zod checks for it when schemas are created, so
// turn its eval-based fast path off before any schema here exists.
z.config({ jitless: true });

// "unknown" means there is no data source for the node yet.
export const statusSchema = z.enum(["up", "degraded", "down", "unknown"]);

export const nodeSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["core", "project", "machine"]),
    role: z.string(),
    description: z.string(),
    status: statusSchema,
    // null when there are no metrics for this node yet.
    cpu: z.number().min(0).max(100).nullable(),
    ram: z.number().min(0).max(100).nullable(),
    // Public link for the side panel, null for none.
    url: z.url().nullable(),
    // Seconds since boot, for machines and the core. null when unknown.
    uptime: z.number().nonnegative().nullable(),
    // Battery percent, sent by machines that report through heartbeats.
    battery: z.number().min(0).max(100).nullable().optional(),
});

export const siteSchema = z.object({
    title: z.string().min(1),
    description: z.string(),
});

export const fleetSchema = z.object({
    updatedAt: z.number(),
    site: siteSchema,
    core: nodeSchema,
    projects: z.array(nodeSchema),
    machines: z.array(nodeSchema),
});

export type Status = z.infer<typeof statusSchema>;
export type FleetNode = z.infer<typeof nodeSchema>;
export type Site = z.infer<typeof siteSchema>;
export type Fleet = z.infer<typeof fleetSchema>;
