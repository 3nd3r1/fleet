import { describe, expect, it } from "vitest";

import {
    INTRO_KEY,
    launchProgress,
    markIntroSeen,
    shouldPlayIntro,
} from "@/lib/intro";

const storage = (seen: boolean) => ({
    getItem: (key: string) => (seen && key === INTRO_KEY ? "1" : null),
});

describe("shouldPlayIntro", () => {
    it("plays on the first visit", () => {
        expect(
            shouldPlayIntro({
                storage: storage(false),
                search: "",
                reducedMotion: false,
            })
        ).toBe(true);
    });

    it("skips once seen", () => {
        expect(
            shouldPlayIntro({
                storage: storage(true),
                search: "",
                reducedMotion: false,
            })
        ).toBe(false);
    });

    it("replays with ?intro", () => {
        expect(
            shouldPlayIntro({
                storage: storage(true),
                search: "?intro",
                reducedMotion: false,
            })
        ).toBe(true);
    });

    it("never plays with reduced motion", () => {
        expect(
            shouldPlayIntro({
                storage: storage(false),
                search: "?intro",
                reducedMotion: true,
            })
        ).toBe(false);
    });

    it("skips when storage is blocked", () => {
        const blocked = {
            getItem: () => {
                throw new Error("blocked");
            },
        };
        expect(
            shouldPlayIntro({
                storage: blocked,
                search: "",
                reducedMotion: false,
            })
        ).toBe(false);
    });
});

describe("markIntroSeen", () => {
    it("stores the flag and survives blocked storage", () => {
        const saved: Record<string, string> = {};
        markIntroSeen({ setItem: (k, v) => (saved[k] = v) });
        expect(saved[INTRO_KEY]).toBe("1");
        expect(() =>
            markIntroSeen({
                setItem: () => {
                    throw new Error("blocked");
                },
            })
        ).not.toThrow();
    });
});

describe("launchProgress", () => {
    it("goes from 0 to 1", () => {
        expect(launchProgress(0, 0)).toBe(0);
        expect(launchProgress(0.5, 0)).toBeGreaterThan(0);
        expect(launchProgress(5, 0)).toBe(1);
    });

    it("staggers ships", () => {
        expect(launchProgress(0.3, 5)).toBeLessThan(launchProgress(0.3, 0));
    });
});
