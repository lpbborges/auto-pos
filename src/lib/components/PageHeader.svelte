<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    children?: Snippet;
  }

  let { title, children }: Props = $props();
</script>

<header class="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
  <div class="flex min-h-[56px] items-center justify-between px-4 py-3">
    <h1 class="text-xl font-bold text-foreground">{title}</h1>
    {@render children?.()}
  </div>
</header>
