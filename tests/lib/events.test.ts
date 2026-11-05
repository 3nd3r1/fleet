import { describe, expect, it } from "vitest";

import { statusChanges } from "@/lib/events";
import { createMock } from "@/lib/mock";

describe("statusChanges", () => {
    it("returns nothing without a previous snapshot", () => {
        expect(statusChanges(null, createMock().next())).toEqual([]);
    });

    it("reports nodes whose status changed", () => {
        const prev = createMock().next();
        const next = structuredClone(prev);
        next.updatedAt = prev.updatedAt + 2000;
        next.projects[0].status = "down";

        expect(statusChanges(prev, next)).toEqual([
            {
                at: next.updatedAt,
                name: next.projects[0].name,
                kind: "project",
                status: "down",
            },
        ]);
    });

    it("ignores unchanged nodes", () => {
        const prev = createMock().next();
        expect(statusChanges(prev, structuredClone(prev))).toEqual([]);
    });
});
