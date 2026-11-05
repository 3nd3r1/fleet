import { describe, expect, it } from "vitest";

import { fleetSchema } from "@/validators/fleet";

import { createMock } from "@/lib/mock";
import { allNodes } from "@/lib/nodes";

function strings(value: unknown): string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(strings);
    if (value && typeof value === "object") {
        return Object.values(value).flatMap(strings);
    }
    return [];
}

describe("createMock", () => {
    it("produces snapshots that match the schema", () => {
        const mock = createMock();
        for (let i = 0; i < 500; i++) {
            expect(fleetSchema.safeParse(mock.next()).success).toBe(true);
        }
    });

    it("never contains IPs, ports or versions", () => {
        const mock = createMock();
        const text = strings(mock.next()).join("\n");
        expect(text).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/);
        expect(text).not.toMatch(/:\d{2,5}\b/);
        expect(text).not.toMatch(/\bv?\d+\.\d+(\.\d+)?\b/);
    });

    it("zeroes metrics for nodes that are down", () => {
        const mock = createMock();
        for (let i = 0; i < 500; i++) {
            for (const node of allNodes(mock.next())) {
                if (node.status === "down") {
                    expect(node.cpu).toBe(0);
                    expect(node.ram).toBe(0);
                }
            }
        }
    });

    it("starts with a degraded project and an offline machine", () => {
        const fleet = createMock().next();
        expect(fleet.projects.some((p) => p.status === "degraded")).toBe(true);
        expect(fleet.machines.some((m) => m.status === "down")).toBe(true);
    });
});
