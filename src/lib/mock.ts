import type { Fleet, FleetNode, Status } from "@/validators/fleet";

// Mock data for building the visuals. Never put IPs, ports or versions here.

type Seed = Omit<FleetNode, "status">;

const CORE: Seed = {
    id: "eros",
    name: "eros",
    kind: "core",
    role: "vps · coolify",
    description:
        "Runs Coolify and every project orbiting it, this page included.",
    cpu: 0,
    ram: 0,
};

const project = (
    name: string,
    cpu: number,
    ram: number,
    description = ""
): Seed => ({
    id: name,
    name,
    kind: "project",
    role: "project",
    description,
    cpu,
    ram,
});

const PROJECTS: Seed[] = [
    project("fleet", 1, 2, "This page."),
    project("ender-page", 2, 5),
    project("booru", 9, 18),
    project("datakolo", 6, 14),
    project("timescaledb-tune", 4, 9),
    project("bloglist", 3, 8),
    project("millonkutsunnat", 2, 6),
    project("protaskinate", 5, 12),
    project("thrivy", 7, 15),
    project("ender-drive", 6, 22),
];

const machine = (
    name: string,
    role: string,
    cpu: number,
    ram: number,
    description: string
): Seed => ({
    id: name,
    name,
    kind: "machine",
    role,
    description,
    cpu,
    ram,
});

const MACHINES: Seed[] = [
    machine(
        "bean",
        "laptop",
        12,
        41,
        "NixOS with Hyprland. Most deploys to eros start here."
    ),
    machine("jane", "phone", 4, 46, "Pixel 10."),
    machine("dragon", "desktop", 8, 30, "Desktop."),
    machine("graff", "work mac", 18, 55, "Work machine."),
];

interface Live {
    status: Status;
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
    Object.assign(live.get("booru")!, { status: "degraded", left: 90 });
    Object.assign(live.get("graff")!, { status: "down", left: 140 });

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
            projects.reduce((total, p) => total + p[key], 0);
        const cpu = clamp(5 + sum("cpu") * 0.4 + (rng() - 0.5) * 3, 1, 99);
        const ram = clamp(28 + sum("ram") * 0.25, 1, 99);

        return {
            updatedAt: now(),
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
