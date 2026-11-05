import type { Fleet, FleetNode, Status } from "@/validators/fleet";

export function allNodes(fleet: Fleet): FleetNode[] {
    return [fleet.core, ...fleet.projects, ...fleet.machines];
}

type StatusOf = Pick<FleetNode, "kind" | "status">;

// A machine that is down is just switched off, not an incident.
const isOffline = (node: StatusOf) =>
    node.kind === "machine" && node.status === "down";

export function statusLabel(node: StatusOf): string {
    if (node.status === "unknown") return "no signal";
    return isOffline(node) ? "offline" : node.status;
}

export function statusColor(node: StatusOf): string {
    if (node.status === "unknown" || isOffline(node)) return "var(--color-dim)";
    return `var(--color-${node.status})`;
}

// Whether a node is live enough to show traffic on its link.
export function isActive(node: StatusOf): boolean {
    return node.status !== "down" && node.status !== "unknown";
}

export function formatPercent(value: number | null, digits = 0): string {
    return value === null ? "—" : `${value.toFixed(digits)}%`;
}

export function countStatuses(fleet: Fleet): Record<Status, number> {
    const counts: Record<Status, number> = {
        up: 0,
        degraded: 0,
        down: 0,
        unknown: 0,
    };
    for (const node of [fleet.core, ...fleet.projects]) counts[node.status]++;
    return counts;
}
