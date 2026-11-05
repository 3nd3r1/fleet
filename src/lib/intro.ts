// The intro (boot lines, then ships launching into orbit) plays once per
// browser. ?intro in the URL replays it. Skipped for reduced motion.

export const INTRO_KEY = "fleet:intro-seen";

export type IntroPhase = "hold" | "launch" | "off";

interface IntroEnv {
    storage: Pick<Storage, "getItem"> | null;
    search: string;
    reducedMotion: boolean;
    enabled?: boolean;
}

export function shouldPlayIntro({
    storage,
    search,
    reducedMotion,
    enabled = true,
}: IntroEnv): boolean {
    if (!enabled || reducedMotion) return false;
    if (new URLSearchParams(search).has("intro")) return true;
    try {
        return storage?.getItem(INTRO_KEY) === null;
    } catch {
        return false;
    }
}

export function markIntroSeen(storage: Pick<Storage, "setItem"> | null) {
    try {
        storage?.setItem(INTRO_KEY, "1");
    } catch {
        // Private mode or blocked storage: the intro just plays again.
    }
}

// Ships leave the core one after another and ease out to their orbit.
export function launchProgress(
    elapsed: number,
    index: number,
    duration = 1.1,
    stagger = 0.045
): number {
    const p = Math.min(1, Math.max(0, (elapsed - index * stagger) / duration));
    return 1 - (1 - p) ** 3;
}
