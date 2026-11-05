import { describe, expect, it } from "vitest";

import { createMock } from "@/lib/mock";
import {
    countStatuses,
    formatUptime,
    statusColor,
    statusLabel,
} from "@/lib/nodes";

describe("statusLabel and statusColor", () => {
    it("shows a down machine as offline in a dim color", () => {
        const node = { kind: "machine", status: "down" } as const;
        expect(statusLabel(node)).toBe("offline");
        expect(statusColor(node)).toBe("var(--color-dim)");
    });

    it("shows a down project as down in red", () => {
        const node = { kind: "project", status: "down" } as const;
        expect(statusLabel(node)).toBe("down");
        expect(statusColor(node)).toBe("var(--color-down)");
    });
});

describe("countStatuses", () => {
    it("counts eros and projects but not machines", () => {
        const fleet = createMock().next();
        const counts = countStatuses(fleet);
        expect(counts.up + counts.degraded + counts.down).toBe(
            fleet.projects.length + 1
        );
    });
});

describe("unknown status", () => {
    it("reads as no signal in a dim color", () => {
        const node = { kind: "machine", status: "unknown" } as const;
        expect(statusLabel(node)).toBe("no signal");
        expect(statusColor(node)).toBe("var(--color-dim)");
    });
});

describe("formatUptime", () => {
    it("picks the two biggest units", () => {
        expect(formatUptime(1_689_275)).toBe("19d 13h");
        expect(formatUptime(3_700)).toBe("1h 1m");
        expect(formatUptime(120)).toBe("2m");
    });
});
