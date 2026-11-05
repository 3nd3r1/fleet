<script lang="ts">
    import { onMount } from "svelte";

    import type { Fleet } from "@/validators/fleet";

    import {
        EROS_RADIUS,
        ORBIT_RADII,
        OUTPOST_RADIUS,
        asteroidPath,
        bracketPath,
        layoutOrbit,
        outpostAngle,
        packet,
        polar,
        speedFactor,
    } from "@/lib/geometry";
    import { isActive, statusColor } from "@/lib/nodes";

    interface Props {
        fleet: Fleet;
        activeId: string;
        onhover: (id: string | null) => void;
        onselect: (id: string | null) => void;
    }

    let { fleet, activeId, onhover, onselect }: Props = $props();

    const VIEW = 520;
    const SCALE_RADIUS = OUTPOST_RADIUS + 42;
    const SHIP = "M9 0L-6 -6L-2 0L-6 6Z";
    const ASTEROID = asteroidPath();
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const ticks = Array.from({ length: 72 }, (_, i) => i * 5).map((deg) => ({
        from: polar(SCALE_RADIUS, rad(deg)),
        to: polar(SCALE_RADIUS + (deg % 30 === 0 ? 10 : 4), rad(deg)),
    }));
    const bearings = [0, 90, 180, 270].map((deg) => ({
        label: String(deg).padStart(3, "0"),
        ...polar(SCALE_RADIUS + 26, rad(deg)),
    }));

    let t = $state(0);
    const angles: Record<string, number> = $state({});

    onMount(() => {
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) return;
        let last = performance.now();
        let frame = 0;
        const loop = (now: number) => {
            const dt = Math.min((now - last) / 1000, 0.1);
            last = now;
            t += dt;
            fleet.projects.forEach((p, i) => {
                const orbit = layoutOrbit(i, fleet.projects.length);
                angles[p.id] =
                    (angles[p.id] ?? orbit.phase) +
                    orbit.speed * speedFactor(p.status) * dt;
            });
            frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
    });

    const ships = $derived(
        fleet.projects.map((node, i) => {
            const orbit = layoutOrbit(i, fleet.projects.length);
            const angle = angles[node.id] ?? orbit.phase;
            return {
                node,
                ...polar(orbit.radius, angle),
                heading: (angle * 180) / Math.PI + 90,
            };
        })
    );

    const outposts = $derived(
        fleet.machines.map((node, i) => {
            const angle = outpostAngle(i, fleet.machines.length, t);
            const from = polar(EROS_RADIUS + 22, angle);
            const to = polar(OUTPOST_RADIUS - 18, angle);
            const along = (p: number) => ({
                x: from.x + (to.x - from.x) * p,
                y: from.y + (to.y - from.y) * p,
            });
            return {
                node,
                ...polar(OUTPOST_RADIUS, angle),
                from,
                to,
                packets: !isActive(node)
                    ? []
                    : [
                          along(packet(t, 6 + i, i * 0.37)),
                          along(1 - packet(t, 9 + i * 1.5, i * 0.61)),
                      ],
            };
        })
    );

    const activeShip = $derived(ships.find((s) => s.node.id === activeId));
    // Eros turns one degree per second.
    const rotation = $derived(t);

    function handlers(id: string) {
        return {
            onpointerenter: () => onhover(id),
            onpointerleave: () => onhover(null),
            onfocus: () => onhover(id),
            onblur: () => onhover(null),
            onclick: (e: MouseEvent) => {
                e.stopPropagation();
                onselect(id);
            },
            onkeydown: (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onselect(id);
                }
            },
        };
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<svg
    viewBox="{-VIEW} {-VIEW} {VIEW * 2} {VIEW * 2}"
    class="size-full select-none"
    onclick={() => onselect(null)}
>
    <g fill="none" stroke="var(--color-faint)">
        {#each ORBIT_RADII as r (r)}
            <circle {r} stroke-dasharray="2 6" />
        {/each}
        <circle r={OUTPOST_RADIUS} stroke-opacity="0.5" />
        <circle r={SCALE_RADIUS} />
        {#each ticks as tick, i (i)}
            <line
                x1={tick.from.x}
                y1={tick.from.y}
                x2={tick.to.x}
                y2={tick.to.y}
            />
        {/each}
    </g>
    {#each bearings as b (b.label)}
        <text
            x={b.x}
            y={b.y}
            text-anchor="middle"
            dominant-baseline="middle"
            class="label bearing">{b.label}</text
        >
    {/each}

    {#each outposts as o (o.node.id)}
        <line
            x1={o.from.x}
            y1={o.from.y}
            x2={o.to.x}
            y2={o.to.y}
            stroke="var(--color-faint)"
            stroke-dasharray="1 5"
        />
        {#each o.packets as p, i (i)}
            <circle cx={p.x} cy={p.y} r="1.8" fill="var(--color-dim)" />
        {/each}
    {/each}

    {#if activeShip}
        <line
            x1="0"
            y1="0"
            x2={activeShip.x}
            y2={activeShip.y}
            stroke="var(--color-dim)"
            stroke-dasharray="1 4"
        />
    {/if}

    <g
        role="button"
        tabindex="0"
        aria-label="eros, {fleet.core.status}"
        class="node"
        {...handlers(fleet.core.id)}
    >
        <circle r={EROS_RADIUS + 16} fill="transparent" />
        <g transform="rotate({rotation})">
            <path
                d={ASTEROID}
                fill="var(--color-space)"
                stroke="var(--color-ink)"
                stroke-width="1.2"
            />
            <circle
                cx="-30"
                cy="-4"
                r="6"
                fill="none"
                stroke="var(--color-dim)"
            />
            <circle
                cx="28"
                cy="6"
                r="4"
                fill="none"
                stroke="var(--color-dim)"
            />
            <circle cx="36" cy="-6" r="2" fill="var(--color-dim)" />
        </g>
        <text
            y={EROS_RADIUS + 34}
            text-anchor="middle"
            class={["label", "core", activeId === "eros" && "active"]}
            >EROS</text
        >
        {#if activeId === fleet.core.id}
            <path
                d={bracketPath(EROS_RADIUS + 14, 10)}
                fill="none"
                stroke="var(--color-ink)"
            />
        {/if}
    </g>

    {#each ships as s (s.node.id)}
        {@const active = activeId === s.node.id}
        <g
            role="button"
            tabindex="0"
            aria-label="{s.node.name}, {s.node.status}"
            transform="translate({s.x} {s.y})"
            class="node"
            {...handlers(s.node.id)}
        >
            <circle r="22" fill="transparent" class="glyph" />
            <path
                d={SHIP}
                transform="rotate({s.heading})"
                fill={statusColor(s.node)}
                class={["glyph", s.node.status === "down" && "blink"]}
            />
            <text
                x={s.x < 0 ? -16 : 16}
                y="4"
                text-anchor={s.x < 0 ? "end" : "start"}
                class={["label", "ship", active && "active"]}
                >{s.node.name}</text
            >
            {#if active}
                <path
                    d={bracketPath(16)}
                    fill="none"
                    stroke="var(--color-ink)"
                />
            {/if}
        </g>
    {/each}

    {#each outposts as o (o.node.id)}
        {@const active = activeId === o.node.id}
        {@const color = statusColor(o.node)}
        <g
            role="button"
            tabindex="0"
            aria-label="{o.node.name}, {o.node.status}"
            transform="translate({o.x} {o.y})"
            class="node"
            {...handlers(o.node.id)}
        >
            <g class="glyph">
                <circle r="24" fill="transparent" />
                <rect
                    x="-7"
                    y="-7"
                    width="14"
                    height="14"
                    fill="var(--color-space)"
                    stroke={color}
                />
                <rect x="-2" y="-2" width="4" height="4" fill={color} />
            </g>
            <text
                x={o.x < 0 ? -18 : 18}
                y="-1"
                text-anchor={o.x < 0 ? "end" : "start"}
                class={["label", "outpost", active && "active"]}
                >{o.node.name}</text
            >
            <text
                x={o.x < 0 ? -18 : 18}
                y="14"
                text-anchor={o.x < 0 ? "end" : "start"}
                class="label role">{o.node.role}</text
            >
            {#if active}
                <path
                    d={bracketPath(18)}
                    fill="none"
                    stroke="var(--color-ink)"
                />
            {/if}
        </g>
    {/each}
</svg>

<style>
    .node {
        cursor: pointer;
        outline: none;
    }
    .label {
        fill: var(--color-dim);
        font-size: 13px;
        letter-spacing: 0.06em;
    }
    .label.active,
    .label.core {
        fill: var(--color-ink);
    }
    .label.core {
        letter-spacing: 0.3em;
    }
    .label.bearing {
        font-size: 11px;
        opacity: 0.7;
    }
    .label.role {
        font-size: 11px;
        opacity: 0.7;
    }

    /* On a phone the map is small, so labels get bigger and ship labels only
       show for the active ship. The roster lists everything anyway. */
    @media (max-width: 639px) {
        .label {
            font-size: 24px;
        }
        .label.role,
        .label.bearing {
            display: none;
        }
        .label.ship:not(.active) {
            display: none;
        }
        .glyph {
            scale: 1.8;
        }
    }
</style>
