<script lang="ts">
    import { onMount } from "svelte";

    import { createFleet } from "@/lib/fleet.svelte";
    import { allNodes, countStatuses } from "@/lib/nodes";

    import EventLog from "@/components/EventLog.svelte";
    import FleetMap from "@/components/FleetMap.svelte";
    import NodePanel from "@/components/NodePanel.svelte";
    import Roster from "@/components/Roster.svelte";
    import Starfield from "@/components/Starfield.svelte";

    const fleet = createFleet(
        import.meta.env.VITE_FLEET_SOURCE ??
            (import.meta.env.PROD ? "api" : "mock")
    );

    let hoveredId = $state<string | null>(null);
    let selectedId = $state<string | null>(null);
    let now = $state(Date.now());

    const data = $derived(fleet.fleet);
    const activeId = $derived(hoveredId ?? selectedId ?? data?.core.id ?? "");
    const active = $derived(
        data
            ? (allNodes(data).find((n) => n.id === activeId) ?? data.core)
            : null
    );
    const counts = $derived(data ? countStatuses(data) : null);
    const sync = $derived(
        fleet.lost
            ? "signal lost"
            : data
              ? `sync ${Math.max(0, Math.round((now - data.updatedAt) / 1000))}s ago`
              : "connecting"
    );

    const onhover = (id: string | null) => (hoveredId = id);
    const onselect = (id: string | null) => (selectedId = id);

    onMount(() => {
        const stop = fleet.start();
        const clock = setInterval(() => (now = Date.now()), 1000);
        return () => {
            stop();
            clearInterval(clock);
        };
    });
</script>

<svelte:head>
    {#if data}<title>{data.site.title}</title>{/if}
</svelte:head>

<svelte:window
    onkeydown={(e) => {
        if (e.key === "Escape") selectedId = null;
    }}
/>

<Starfield />

<div
    class="grid min-h-dvh lg:h-dvh lg:grid-cols-[1fr_20rem] lg:overflow-hidden"
>
    <section class="relative flex min-h-0 flex-col">
        <header
            class="flex items-start justify-between gap-4 p-4 lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 lg:p-6"
        >
            <div>
                <h1 class="text-sm tracking-[0.3em] uppercase">
                    {data?.site.title ?? ""}
                </h1>
                <p class="mt-1 text-xs text-dim">fleet status</p>
                {#if counts}
                    <p class="mt-3 flex gap-3 text-xs tabular-nums">
                        <span class="text-up">{counts.up} up</span>
                        <span class="text-degraded"
                            >{counts.degraded} degraded</span
                        >
                        <span class="text-down">{counts.down} down</span>
                    </p>
                {/if}
            </div>
            <div class="text-right text-xs tabular-nums">
                <p>{new Date(now).toISOString().slice(11, 19)} UTC</p>
                <p class={["mt-1", fleet.lost ? "text-down" : "text-dim"]}>
                    {sync}
                </p>
            </div>
        </header>

        {#if data}
            <div
                class="aspect-square w-full lg:aspect-auto lg:min-h-0 lg:flex-1"
            >
                <FleetMap fleet={data} {activeId} {onhover} {onselect} />
            </div>
            <div class="absolute bottom-6 left-6 max-lg:hidden">
                <EventLog events={fleet.events} />
            </div>
        {/if}
    </section>

    <aside
        class="space-y-8 bg-space px-4 pb-10 lg:overflow-y-auto lg:border-l lg:border-faint lg:p-6"
    >
        {#if data && active}
            <NodePanel
                node={active}
                coreName={data.core.name}
                history={fleet.history(active.id)}
            />
            <div class="lg:hidden">
                <EventLog events={fleet.events} />
            </div>
            <Roster fleet={data} {activeId} {onhover} {onselect} />
        {/if}
    </aside>
</div>
