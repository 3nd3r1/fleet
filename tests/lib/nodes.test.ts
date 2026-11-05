import { describe, expect, it } from "vitest";

import { createMock } from "@/lib/mock";
import { countStatuses, statusColor, statusLabel } from "@/lib/nodes";

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
