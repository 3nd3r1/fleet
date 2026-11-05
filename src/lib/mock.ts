import type { Fleet, FleetNode, Status } from "@/validators/fleet";

// Mock data for building the visuals. Never put IPs, ports or versions here.

type Seed = Omit<FleetNode, "status" | "cpu" | "ram"> & {
    cpu: number;
    ram: number;
};

// Generic sample data for development. Real deployments get their names,
// descriptions and machines from Coolify and fleet.config.json.
const SITE = {
    title: "fleet (mock)",
    description: "Mock data for development.",
};

const CORE: Seed = {
    id: "core",
    name: "station",
    kind: "core",
    role: "coolify host",
    description: "Runs Coolify and every project orbiting it.",
    cpu: 0,
    ram: 0,
    url: null,
};

const project = (
    name: string,
    cpu: number,
    ram: number,
    description = "",
    url: string | null = null
): Seed => ({
    id: name,
    name,
    kind: "project",
    role: "project",
    description,
    cpu,
    ram,
    url,
});

const PROJECTS: Seed[] = [
    project("fleet", 1, 2, "This page."),
    project("homepage", 2, 5, "Personal site.", "https://example.com"),
    project("gallery", 9, 18, "Image board."),
    project("cms", 6, 14, "Headless CMS.", "https://cms.example.com"),
    project("db-tuner", 4, 9),
    project("blog", 3, 8, "A small blog."),
    project("countdown", 2, 6),
    project("tasks", 5, 12, "Project management."),
    project("jobs", 7, 15),
    project("drive", 6, 22, "File storage."),
];

const machine = (
    name: string,
    role: string,
    cpu: number,
    ram: number,
    description = ""
): Seed => ({
    id: `machine-${name}`,
    name,
    kind: "machine",
    role,
    description,
    cpu,
    ram,
    url: null,
});

const MACHINES: Seed[] = [
    machine("laptop", "laptop", 12, 41),
    machine("phone", "phone", 4, 46),
    machine("desktop", "desktop", 8, 30),
    machine("work", "work machine", 18, 55),
];

interface Live {
    status: Exclude<Status, "unknown">;
    cpu: number;
    ram: number;
    // Ticks left until an incident (or an offline stretch) ends.
    left: number;
}

const clamp = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 10) / 10;

export function createMock(
    rng: () => number = Math.random,
    now: () => number = Date.now
) {
    const live = new Map<string, Live>(
        [...PROJECTS, ...MACHINES].map((s) => [
            s.id,
            { status: "up", cpu: s.cpu, ram: s.ram, left: 0 },
        ])
    );

    // Start with something going on, so every state shows up early.
    Object.assign(live.get("gallery")!, { status: "degraded", left: 90 });
    Object.assign(live.get("machine-work")!, { status: "down", left: 140 });

    const anyDown = () =>
        PROJECTS.some((p) => live.get(p.id)!.status === "down");

    function step(seed: Seed) {
        const s = live.get(seed.id)!;
        if (s.left > 0) {
            s.left--;
            if (s.left === 0) s.status = "up";
        } else {
            const roll = rng();
            if (seed.kind === "project") {
                if (roll < 0.0006 && !anyDown()) {
                    s.status = "down";
                    s.left = 10 + Math.floor(rng() * 15);
                } else if (roll < 0.003) {
                    s.status = "degraded";
                    s.left = 15 + Math.floor(rng() * 25);
                }
            } else if (roll < 0.002) {
                s.status = "down";
                s.left = 30 + Math.floor(rng() * 60);
            }
        }

        if (s.status === "down") {
            s.cpu = 0;
            s.ram = 0;
            return;
        }
        const busy = s.status === "degraded";
        const cpuTarget = busy ? Math.min(seed.cpu * 4 + 40, 96) : seed.cpu;
        const ramTarget = busy ? Math.min(seed.ram * 2 + 20, 92) : seed.ram;
        if (s.ram === 0) s.ram = seed.ram;
        s.cpu = clamp(
            s.cpu +
                (cpuTarget - s.cpu) * 0.2 +
                (rng() - 0.5) * (seed.cpu * 0.8 + 1),
            0.3,
            99
        );
        s.ram = clamp(
            s.ram + (ramTarget - s.ram) * 0.08 + (rng() - 0.5) * 1.2,
            1,
            99
        );
    }

    function snapshot(seed: Seed): FleetNode {
        const s = live.get(seed.id)!;
        return {
            ...seed,
            status: s.status,
            cpu: round(s.cpu),
            ram: round(s.ram),
        };
    }

    function next(): Fleet {
        [...PROJECTS, ...MACHINES].forEach(step);
        const projects = PROJECTS.map(snapshot);
        const sum = (key: "cpu" | "ram") =>
            projects.reduce((total, p) => total + (p[key] ?? 0), 0);
        const cpu = clamp(5 + sum("cpu") * 0.4 + (rng() - 0.5) * 3, 1, 99);
        const ram = clamp(28 + sum("ram") * 0.25, 1, 99);

        return {
            updatedAt: now(),
            site: SITE,
            core: {
                ...CORE,
                status: cpu > 85 ? "degraded" : "up",
                cpu: round(cpu),
                ram: round(ram),
            },
            projects,
            machines: MACHINES.map(snapshot),
        };
    }

    return { next };
}
