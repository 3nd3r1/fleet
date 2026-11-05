<script lang="ts">
    import { onMount } from "svelte";

    import type { Fleet } from "@/validators/fleet";

    interface Props {
        fleet: Fleet | null;
        lost: boolean;
        // Called when the overlay starts fading, and when it's gone.
        onleave: () => void;
        ondone: () => void;
    }

    let { fleet, lost, onleave, ondone }: Props = $props();

    // 0: linking, 1: waiting for data, 2: data in (or lost), fading out.
    let phase = $state(0);
    let leaving = $state(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) =>
        timers.push(setTimeout(fn, ms));

    onMount(() => {
        later(380, () => (phase = 1));
        return () => timers.forEach(clearTimeout);
    });

    // Only move on once the data is actually here, then leave quickly.
    $effect(() => {
        if (phase !== 1 || (!fleet && !lost)) return;
        later(260, () => {
            phase = 2;
            later(lost ? 700 : 480, () => {
                leaving = true;
                onleave();
                later(320, ondone);
            });
        });
    });

    const lines = $derived(
        [
            {
                text: "establishing ansible link",
                result: phase >= 1 ? "ok" : null,
                failed: false,
            },
            phase >= 1 && {
                text: `contacting ${fleet?.core.name ?? "fleet"}`,
                result: phase >= 2 ? (lost ? "no signal" : "ok") : null,
                failed: lost,
            },
            phase >= 2 &&
                fleet && {
                    text: `${fleet.projects.length} ships · ${fleet.machines.length} outposts`,
                    result: "",
                    failed: false,
                },
        ].filter((line) => !!line)
    );
</script>

<div
    class={[
        "fixed inset-0 z-50 flex items-center justify-center bg-space transition-opacity duration-300",
        leaving && "pointer-events-none opacity-0",
    ]}
    aria-hidden="true"
>
    <ol class="w-72 space-y-1.5 text-xs text-dim">
        {#each lines as line (line.text)}
            <li class="flex justify-between gap-4">
                <span class="typing" style:--chars={line.text.length}
                    >{line.text}</span
                >
                {#if line.result === null}
                    <span class="caret">▍</span>
                {:else if line.result}
                    <span class={line.failed ? "text-down" : "text-up"}
                        >{line.result}</span
                    >
                {/if}
            </li>
        {/each}
    </ol>
</div>

<style>
    .typing {
        display: inline-block;
        overflow: hidden;
        white-space: nowrap;
        width: calc(var(--chars) * 1ch);
        animation: type 260ms steps(var(--chars)) both;
    }

    @keyframes type {
        from {
            width: 0;
        }
    }

    .caret {
        animation: blink 0.9s steps(2, jump-none) infinite;
    }
</style>
