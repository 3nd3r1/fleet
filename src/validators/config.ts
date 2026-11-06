import { z } from "zod";

// fleet.config.json. Everything is optional: with no config at all, fleet
// shows whatever Coolify knows.

export const DEFAULT_SUFFIXES = [
    "frontend",
    "backend",
    "page",
    "ui",
    "database",
    "db",
    "api",
    "web",
];

export const projectConfigSchema = z.strictObject({
    name: z
        .string()
        .min(1)
        .optional()
        .describe("Display name. Defaults to the grouped Coolify name."),
    description: z
        .string()
        .optional()
        .describe(
            "One line for the side panel. Overrides the Coolify description."
        ),
    url: z
        .union([z.url({ protocol: /^https$/ }), z.literal(false)])
        .optional()
        .describe(
            "Link for the side panel, or false for no link. Defaults to the project's public Coolify domain."
        ),
    hidden: z.boolean().optional().describe("Leave this project off the page."),
});

export const machineConfigSchema = z.strictObject({
    id: z
        .string()
        .regex(/^[a-z0-9-]+$/, "use lowercase letters, numbers and dashes"),
    name: z.string().min(1).optional(),
    role: z.string().default("machine"),
    description: z.string().default(""),
    beszel: z
        .string()
        .optional()
        .describe(
            "Beszel system name. Defaults to the machine name, matched case-insensitively."
        ),
    heartbeat: z
        .number()
        .int()
        .min(60)
        .optional()
        .describe(
            "Take the status from POST /api/heartbeat/<id> instead: up while heartbeats arrive, offline after this many seconds without one."
        ),
});

export const fleetConfigSchema = z.strictObject({
    $schema: z.string().optional(),
    site: z
        .strictObject({
            title: z.string().min(1).default("fleet"),
            description: z
                .string()
                .default(
                    "A live map of servers and the projects running on them."
                ),
            icon: z
                .url({ protocol: /^https$/ })
                .optional()
                .describe(
                    "Favicon URL (PNG, SVG or ICO). Defaults to fleet's own icon."
                ),
            intro: z
                .boolean()
                .default(true)
                .describe(
                    "Play the boot sequence and ship launch on a visitor's first visit."
                ),
        })
        .prefault({}),
    core: z
        .strictObject({
            name: z
                .string()
                .min(1)
                .optional()
                .describe(
                    "Name of the Coolify host. Defaults to the server name in Coolify."
                ),
            role: z.string().default("coolify host"),
            beszel: z
                .string()
                .optional()
                .describe(
                    "Beszel system name for the host. Defaults to the core name, matched case-insensitively."
                ),
            description: z
                .string()
                .default("Runs Coolify and every project orbiting it."),
        })
        .prefault({}),
    grouping: z
        .strictObject({
            suffixes: z
                .array(z.string().min(1))
                .default(DEFAULT_SUFFIXES)
                .describe(
                    'Name endings stripped to group resources: "blog-frontend" and "blog-backend" become "blog".'
                ),
            aliases: z
                .record(z.string(), z.string())
                .default({})
                .describe("Map a Coolify resource name to a project id."),
        })
        .prefault({}),
    projects: z
        .record(z.string(), projectConfigSchema)
        .default({})
        .describe("Per-project settings, keyed by grouped project id."),
    machines: z
        .array(machineConfigSchema)
        .default([])
        .describe("Machines outside Coolify, shown at the edge of the map."),
});

export type FleetConfig = z.infer<typeof fleetConfigSchema>;
export type FleetConfigInput = z.input<typeof fleetConfigSchema>;
