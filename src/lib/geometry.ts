import type { Status } from "@/validators/fleet";

const TAU = Math.PI * 2;

export const EROS_RADIUS = 54;
export const ORBIT_RADII = [170, 275] as const;
export const OUTPOST_RADIUS = 420;
export const INNER_SLOTS = 4;
// Seconds per full orbit, inner ring first.
const PERIODS = [160, 280] as const;

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

export function layoutOrbit(index: number, count: number): Orbit {
    const ring = index < INNER_SLOTS ? 0 : 1;
    const slots =
        ring === 0
            ? Math.min(count, INNER_SLOTS)
            : Math.max(count - INNER_SLOTS, 1);
    const slot = ring === 0 ? index : index - INNER_SLOTS;
    return {
        radius: ORBIT_RADII[ring],
        phase: (TAU * slot) / slots + ring * 0.5,
        speed: TAU / PERIODS[ring],
    };
}

// Degraded ships slow down, down ships stop.
export function speedFactor(status: Status): number {
    return status === "up" ? 1 : status === "degraded" ? 0.3 : 0;
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
