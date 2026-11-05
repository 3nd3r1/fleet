// Projects to leave off the public page, by grouped name (see projectName).
export const HIDDEN = new Set<string>([]);

// One-line descriptions shown in the side panel. Falls back to the Coolify
// description, then to "Deployed on eros."
export const DESCRIPTIONS: Record<string, string> = {
    fleet: "This page.",
};
