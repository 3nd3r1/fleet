<script lang="ts">
    import type { FleetEvent } from "@/lib/events";
    import { statusColor, statusLabel } from "@/lib/nodes";

    interface Props {
        events: FleetEvent[];
    }

    let { events }: Props = $props();

    const time = (ms: number) => new Date(ms).toISOString().slice(11, 19);
</script>

<div>
    <h3 class="text-xs tracking-[0.2em] text-dim uppercase">log</h3>
    <ol class="mt-1.5 space-y-1 text-xs">
        {#each events as e, i (e.id)}
            <li class="flex gap-3" style:opacity={1 - i * 0.14}>
                <time class="text-dim tabular-nums">{time(e.at)}</time>
                <span>{e.name}</span>
                <span style:color={statusColor(e)}>{statusLabel(e)}</span>
            </li>
        {:else}
            <li class="text-dim">all quiet</li>
        {/each}
    </ol>
</div>
