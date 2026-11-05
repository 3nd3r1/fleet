import { type Fleet, fleetSchema } from "@/validators/fleet";

import { type FleetEvent, statusChanges } from "@/lib/events";
import { createMock } from "@/lib/mock";
import { allNodes } from "@/lib/nodes";

// All fleet data loading goes through here. Switching from mock to the real
// backend is VITE_FLEET_SOURCE=api plus a /api/fleet route on the server.

export type FleetSource = "mock" | "api";

const HISTORY = 60;
const LOG = 6;
const INTERVAL: Record<FleetSource, number> = { mock: 2_000, api: 15_000 };

export function createFleet(source: FleetSource = "mock") {
    const mock = createMock();
    let fleet = $state<Fleet | null>(null);
    let lost = $state(false);
    let events = $state<FleetEvent[]>([]);
    const history: Record<string, number[]> = $state({});
    let eventId = 0;

    async function load(): Promise<Fleet> {
        if (source === "mock") return mock.next();
        const res = await fetch("/api/fleet");
        if (!res.ok) throw new Error(`fleet api returned ${res.status}`);
        return fleetSchema.parse(await res.json());
    }

    function apply(next: Fleet, log: boolean) {
        if (log) {
            const changes = statusChanges(fleet, next).map((c) => ({
                ...c,
                id: ++eventId,
            }));
            if (changes.length) {
                events = [...changes.reverse(), ...events].slice(0, LOG);
            }
        }
        for (const node of allNodes(next)) {
            history[node.id] = [...(history[node.id] ?? []), node.cpu].slice(
                -HISTORY
            );
        }
        fleet = next;
    }

    async function tick() {
        try {
            apply(await load(), true);
            lost = false;
        } catch (error) {
            console.error(error);
            lost = true;
        }
    }

    function start() {
        // Prefill mock history so the sparklines aren't empty on load.
        if (source === "mock") {
            for (let i = 0; i < HISTORY - 1; i++) apply(mock.next(), false);
        }
        void tick();
        const id = setInterval(tick, INTERVAL[source]);
        return () => clearInterval(id);
    }

    return {
        get fleet() {
            return fleet;
        },
        get lost() {
            return lost;
        },
        get events() {
            return events;
        },
        history: (id: string) => history[id] ?? [],
        start,
    };
}
