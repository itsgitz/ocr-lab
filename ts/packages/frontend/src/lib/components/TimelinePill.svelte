<script lang="ts">
  let { stage, label }: { stage: "thinking" | "reading" | "editing" | "done"; label: string } = $props();

  const bgMap: Record<string, string> = {
    thinking: "bg-timeline-thinking text-ink",
    reading: "bg-timeline-read text-ink",
    editing: "bg-timeline-edit text-ink",
    done: "bg-timeline-done text-on-primary",
  };
</script>

<span
  class="inline-block rounded-pill px-[10px] py-[4px] typo-caption-uppercase {bgMap[stage]}"
>
  {label}
</span>
