<script lang="ts">
    import type { FleetNode } from "@/validators/fleet";

    import {
        formatPercent,
        formatUptime,
        statusColor,
        statusLabel,
    } from "@/lib/nodes";

    import Sparkline from "@/components/Sparkline.svelte";

    interface Props {
        node: FleetNode;
        coreName: string;
        history: number[];
    }

    let { node, coreName, history }: Props = $props();

    const host = $derived(node.url ? new URL(node.url).host : null);

    const down = $derived(node.status === "down");
    const hasMetrics = $derived(node.cpu !== null || node.ram !== null);
    const metrics = $derived([
        { label: "cpu", value: node.cpu },
        { label: "ram", value: node.ram },
    ]);
</script>

<section>
    <div class="flex items-center justify-between text-xs">
        <p class="tracking-[0.2em] text-dim uppercase">{node.role}</p>
        <p
            class="flex items-center gap-2 tracking-[0.2em] uppercase"
            style:color={statusColor(node)}
        >
            <span
                class={["size-1.5 bg-current", down && "blink"]}
                aria-hidden="true"
            ></span>
            {statusLabel(node)}
        </p>
    </div>
    <h2 class="mt-2 text-2xl">{node.name}</h2>
    <p class="mt-2 min-h-10 text-sm leading-relaxed text-dim">
        {node.description ||
            (node.kind === "project" ? `Deployed on ${coreName}.` : "")}
    </p>
    {#if node.url && host}
        <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-3 inline-flex items-center gap-1.5 text-sm text-ink underline decoration-faint underline-offset-4 transition-colors hover:decoration-ink"
        >
            {host}<span aria-hidden="true" class="text-dim">↗</span>
        </a>
    {/if}

    <dl class="mt-6 space-y-4">
        {#if node.uptime !== null}
            <div class="flex justify-between text-xs">
                <dt class="tracking-[0.2em] text-dim uppercase">uptime</dt>
                <dd class="tabular-nums">{formatUptime(node.uptime)}</dd>
            </div>
        {/if}
        {#each metrics as m (m.label)}
            <div>
                <div class="flex justify-between text-xs">
                    <dt class="tracking-[0.2em] text-dim uppercase">
                        {m.label}
                    </dt>
                    <dd class="tabular-nums">
                        {formatPercent(m.value, 1)}
                    </dd>
                </div>
                <div class="mt-1.5 h-px bg-faint">
                    <div
                        class="h-px transition-[width] duration-700"
                        style:width="{m.value ?? 0}%"
                        style:background-color={statusColor(node)}
                    ></div>
                </div>
            </div>
        {/each}
    </dl>

    <div class="mt-6 text-dim">
        {#if hasMetrics && history.length > 1}
            <p class="text-xs tracking-[0.2em] uppercase">cpu · recent</p>
            <div class="mt-2"><Sparkline values={history} /></div>
        {:else}
            <p class="text-xs tracking-[0.2em] uppercase">no metrics yet</p>
        {/if}
    </div>
</section>
