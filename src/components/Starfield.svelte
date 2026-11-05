<script lang="ts">
    // Fixed seed so the sky looks the same on every load.
    function mulberry32(seed: number) {
        return () => {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const rng = mulberry32(1985);
    const stars = Array.from({ length: 160 }, () => ({
        x: rng() * 1600,
        y: rng() * 1000,
        r: 0.4 + rng() * 1.1,
        opacity: 0.12 + rng() * 0.5,
        twinkle: rng() < 0.12,
        delay: rng() * 8,
    }));
</script>

<svg
    class="pointer-events-none fixed inset-0 -z-10 size-full"
    viewBox="0 0 1600 1000"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
>
    {#each stars as star, i (i)}
        <circle
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="var(--color-ink)"
            opacity={star.opacity}
            class={{ twinkle: star.twinkle }}
            style:animation-delay="{star.delay}s"
        />
    {/each}
</svg>
