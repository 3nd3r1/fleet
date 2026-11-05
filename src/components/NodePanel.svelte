<script lang="ts">
    import type { FleetNode } from "@/validators/fleet";

    import { statusColor, statusLabel } from "@/lib/nodes";

    import Sparkline from "@/components/Sparkline.svelte";

    interface Props {
        node: FleetNode;
        history: number[];
    }

    let { node, history }: Props = $props();

    const down = $derived(node.status === "down");
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
        {node.description || "Deployed on eros."}
    </p>

    <dl class="mt-6 space-y-4">
        {#each metrics as m (m.label)}
            <div>
                <div class="flex justify-between text-xs">
                    <dt class="tracking-[0.2em] text-dim uppercase">
                        {m.label}
                    </dt>
                    <dd class="tabular-nums">
                        {down ? "—" : `${m.value.toFixed(1)}%`}
                    </dd>
                </div>
                <div class="mt-1.5 h-px bg-faint">
                    <div
                        class="h-px transition-[width] duration-700"
                        style:width="{m.value}%"
                        style:background-color={statusColor(node)}
                    ></div>
                </div>
            </div>
        {/each}
    </dl>

    <div class="mt-6 text-dim">
        <p class="text-xs tracking-[0.2em] uppercase">cpu · last 2 min</p>
        <div class="mt-2"><Sparkline values={history} /></div>
    </div>
</section>
