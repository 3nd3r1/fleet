import { z } from "zod";

export const statusSchema = z.enum(["up", "degraded", "down"]);

export const nodeSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(["core", "project", "machine"]),
    role: z.string(),
    description: z.string(),
    status: statusSchema,
    cpu: z.number().min(0).max(100),
    ram: z.number().min(0).max(100),
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
