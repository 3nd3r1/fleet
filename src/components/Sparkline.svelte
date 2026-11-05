<script lang="ts">
    interface Props {
        values: number[];
    }

    let { values }: Props = $props();

    const W = 240;
    const H = 40;
    const top = $derived(Math.max(10, ...values) * 1.15);
    const points = $derived(
        values
            .map((v, i) => {
                const x = (i / Math.max(values.length - 1, 1)) * W;
                const y = H - (v / top) * H;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ")
    );
</script>

<svg
    viewBox="0 0 {W} {H}"
    preserveAspectRatio="none"
    class="h-10 w-full"
    aria-hidden="true"
>
    <polyline
        {points}
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
    />
</svg>
