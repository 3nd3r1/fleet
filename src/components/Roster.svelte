<script lang="ts">
    import type { Fleet, FleetNode } from "@/validators/fleet";

    import { formatPercent, statusColor } from "@/lib/nodes";

    interface Props {
        fleet: Fleet;
        activeId: string;
        onhover: (id: string | null) => void;
        onselect: (id: string | null) => void;
    }

    let { fleet, activeId, onhover, onselect }: Props = $props();

    const groups = $derived<{ label: string; nodes: FleetNode[] }[]>([
        { label: "command", nodes: [fleet.core] },
        { label: "ships", nodes: fleet.projects },
        { label: "outposts", nodes: fleet.machines },
    ]);
</script>

<nav aria-label="Fleet roster" class="space-y-5">
    {#each groups as group (group.label)}
        <div>
            <h3 class="text-xs tracking-[0.2em] text-dim uppercase">
                {group.label}
            </h3>
            <ul class="mt-1.5">
                {#each group.nodes as node (node.id)}
                    <li>
                        <button
                            type="button"
                            class={[
                                "flex w-full cursor-pointer items-center gap-3 py-1 text-left text-sm transition-colors hover:text-ink",
                                activeId === node.id ? "text-ink" : "text-dim",
                            ]}
                            onpointerenter={() => onhover(node.id)}
                            onpointerleave={() => onhover(null)}
                            onfocus={() => onhover(node.id)}
                            onblur={() => onhover(null)}
                            onclick={() => onselect(node.id)}
                        >
                            <span
                                class="size-1.5 shrink-0"
                                style:background-color={statusColor(node)}
                                aria-hidden="true"
                            ></span>
                            <span class="flex-1 truncate">{node.name}</span>
                            <span class="text-xs tabular-nums">
                                {formatPercent(node.cpu)}
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</nav>
