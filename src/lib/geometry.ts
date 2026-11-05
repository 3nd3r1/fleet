import type { Status } from "@/validators/fleet";

const TAU = Math.PI * 2;

export const EROS_RADIUS = 54;
export const ORBIT_RADII = [150, 228, 310] as const;
export const OUTPOST_RADIUS = 420;
// Seconds per full orbit, inner ring first.
const PERIODS = [150, 230, 330] as const;

export interface Point {
    x: number;
    y: number;
}

export interface Orbit {
    radius: number;
    phase: number;
    speed: number;
}

export function polar(radius: number, angle: number): Point {
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

// How many ships each ring gets. Rings share ships by circumference, so the
// spacing between ships is about the same on every ring.
export function ringSizes(count: number): number[] {
    const total = ORBIT_RADII.reduce((a, b) => a + b, 0);
    const sizes = ORBIT_RADII.map((r) => Math.floor((count * r) / total));
    let left = count - sizes.reduce((a, b) => a + b, 0);
    for (
        let i = sizes.length - 1;
        left > 0;
        i = (i + sizes.length - 1) % sizes.length
    ) {
        sizes[i]++;
        left--;
    }
    return sizes;
}

export function layoutOrbit(index: number, count: number): Orbit {
    const sizes = ringSizes(count);
    let ring = 0;
    let slot = index;
    while (ring < sizes.length - 1 && slot >= sizes[ring]) {
        slot -= sizes[ring];
        ring++;
    }
    return {
        radius: ORBIT_RADII[ring],
        phase: (TAU * slot) / Math.max(sizes[ring], 1) + ring * 0.45,
        speed: TAU / PERIODS[ring],
    };
}

// Degraded ships slow down, down ships stop.
export function speedFactor(status: Status): number {
    if (status === "down") return 0;
    return status === "degraded" ? 0.3 : 1;
}

const OUTPOST_ANGLES = [-0.72, 0.62, 2.5, 3.8];

export function outpostAngle(index: number, count: number, t: number): number {
    const base = OUTPOST_ANGLES[index] ?? (TAU * index) / count;
    return base + Math.sin(t / 40 + index * 2) * 0.025;
}

// Position (0..1) of a packet travelling along a link.
export function packet(t: number, period: number, offset: number): number {
    return (((t / period + offset) % 1) + 1) % 1;
}

// Eros is a peanut-shaped asteroid: two lobes with a waist, plus a couple of
// slow bumps so it doesn't look machine-made.
export function asteroidPath(radius = EROS_RADIUS, points = 64): string {
    const coords = Array.from({ length: points }, (_, i) => {
        const a = (TAU * i) / points;
        const r =
            radius *
            (0.68 + 0.32 * Math.cos(2 * a)) *
            (1 + 0.05 * Math.sin(3 * a + 0.5) + 0.03 * Math.cos(5 * a + 1));
        const { x, y } = polar(r, a);
        return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M${coords.join("L")}Z`;
}

// Four corner brackets around a point, like a target lock.
export function bracketPath(size: number, arm = 6): string {
    const s = size;
    return [
        `M${-s} ${-s + arm}V${-s}H${-s + arm}`,
        `M${s - arm} ${-s}H${s}V${-s + arm}`,
        `M${s} ${s - arm}V${s}H${s - arm}`,
        `M${-s + arm} ${s}H${-s}V${s - arm}`,
    ].join("");
}
