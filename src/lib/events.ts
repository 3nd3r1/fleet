import type { Fleet, FleetNode } from "@/validators/fleet";

import { allNodes } from "@/lib/nodes";

export interface FleetEvent extends Pick<
    FleetNode,
    "name" | "kind" | "status"
> {
    id: number;
    at: number;
}

export function statusChanges(
    prev: Fleet | null,
    next: Fleet
): Omit<FleetEvent, "id">[] {
    if (!prev) return [];
    const before = new Map(allNodes(prev).map((n) => [n.id, n.status]));
    return allNodes(next)
        .filter((n) => before.has(n.id) && before.get(n.id) !== n.status)
        .map((n) => ({
            at: next.updatedAt,
            name: n.name,
            kind: n.kind,
            status: n.status,
        }));
}
