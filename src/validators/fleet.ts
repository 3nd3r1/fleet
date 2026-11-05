import { z } from "zod";

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
});

export const fleetSchema = z.object({
    updatedAt: z.number(),
    core: nodeSchema,
    projects: z.array(nodeSchema),
    machines: z.array(nodeSchema),
});

export type Status = z.infer<typeof statusSchema>;
export type FleetNode = z.infer<typeof nodeSchema>;
export type Fleet = z.infer<typeof fleetSchema>;
