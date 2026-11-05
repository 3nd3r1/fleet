import type { FleetNode } from "../src/validators/fleet";

// Machines Coolify doesn't know about. Their status and metrics come from
// Beszel later. Until then they show as "no signal".
export const MACHINES: FleetNode[] = [
    ["bean", "laptop", "NixOS with Hyprland. Most deploys to eros start here."],
    ["jane", "phone", "Pixel 10."],
    ["dragon", "desktop", "Desktop."],
    ["graff", "work mac", "Work machine."],
].map(([name, role, description]) => ({
    id: name,
    name,
    kind: "machine",
    role,
    description,
    status: "unknown",
    cpu: null,
    ram: null,
}));
