import { describe, expect, it } from "vitest";

import {
    ORBIT_RADII,
    asteroidPath,
    layoutOrbit,
    packet,
    polar,
    ringSizes,
    speedFactor,
} from "@/lib/geometry";

describe("ringSizes", () => {
    it("places every ship", () => {
        for (const count of [0, 1, 5, 10, 17, 30]) {
            expect(ringSizes(count).reduce((a, b) => a + b, 0)).toBe(count);
        }
    });

    it("gives bigger rings more ships", () => {
        const [inner, middle, outer] = ringSizes(17);
        expect(inner).toBeLessThanOrEqual(middle);
        expect(middle).toBeLessThanOrEqual(outer);
    });
});

describe("layoutOrbit", () => {
    it("fills the inner ring first", () => {
        expect(layoutOrbit(0, 17).radius).toBe(ORBIT_RADII[0]);
        expect(layoutOrbit(16, 17).radius).toBe(ORBIT_RADII.at(-1));
    });

    it("spaces ships on a ring evenly", () => {
        const [inner] = ringSizes(17);
        const a = layoutOrbit(0, 17).phase;
        const b = layoutOrbit(1, 17).phase;
        expect(b - a).toBeCloseTo((Math.PI * 2) / inner);
    });

    it("moves inner rings faster", () => {
        expect(layoutOrbit(0, 17).speed).toBeGreaterThan(
            layoutOrbit(16, 17).speed
        );
    });
});

describe("speedFactor", () => {
    it("slows degraded ships and stops down ones", () => {
        expect(speedFactor("up")).toBe(1);
        expect(speedFactor("degraded")).toBeLessThan(1);
        expect(speedFactor("down")).toBe(0);
    });
});

describe("polar", () => {
    it("converts radius and angle to a point", () => {
        const p = polar(10, Math.PI / 2);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(10);
    });
});

describe("packet", () => {
    it("stays between 0 and 1", () => {
        for (const t of [-5, 0, 3.3, 100]) {
            const p = packet(t, 6, 0.4);
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThan(1);
        }
    });
});

describe("asteroidPath", () => {
    it("is a closed path", () => {
        const d = asteroidPath();
        expect(d.startsWith("M")).toBe(true);
        expect(d.endsWith("Z")).toBe(true);
    });
});
