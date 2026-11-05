import { describe, expect, it } from "vitest";

import {
    INNER_SLOTS,
    ORBIT_RADII,
    asteroidPath,
    layoutOrbit,
    packet,
    polar,
    speedFactor,
} from "@/lib/geometry";

describe("layoutOrbit", () => {
    it("puts the first ships on the inner ring and the rest outside", () => {
        expect(layoutOrbit(0, 10).radius).toBe(ORBIT_RADII[0]);
        expect(layoutOrbit(INNER_SLOTS, 10).radius).toBe(ORBIT_RADII[1]);
    });

    it("spaces ships on a ring evenly", () => {
        const a = layoutOrbit(0, 10).phase;
        const b = layoutOrbit(1, 10).phase;
        expect(b - a).toBeCloseTo((Math.PI * 2) / INNER_SLOTS);
    });

    it("moves the inner ring faster", () => {
        expect(layoutOrbit(0, 10).speed).toBeGreaterThan(
            layoutOrbit(INNER_SLOTS, 10).speed
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
