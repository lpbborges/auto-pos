<script lang="ts">
  import { cn } from "$lib/utils";
  import { X } from "lucide-svelte";
  import { fade, fly } from "svelte/transition";
  import { expoOut } from "svelte/easing";
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    onclose?: () => void;
    side?: "top" | "right" | "bottom" | "left";
    class?: string;
    children?: Snippet;
  }

  let { open = $bindable(false), onclose, side = "right", class: className, children }: Props = $props();

  const flyParams = {
    right: { x: 500, duration: 500, easing: expoOut },
    left: { x: -500, duration: 500, easing: expoOut },
    top: { y: -500, duration: 500, easing: expoOut },
    bottom: { y: 500, duration: 500, easing: expoOut },
  };

  const sideClasses = {
    top: "inset-x-0 top-0 border-b",
    right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  };

  function handleBackdropClick() {
    open = false;
    onclose?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
    <!-- Backdrop -->
    <button
      transition:fade={{ duration: 200 }}
      type="button"
      class="fixed inset-0 bg-black/80"
      onclick={handleBackdropClick}
      aria-label="Close sheet"
    ></button>

    <!-- Content -->
    <div
      transition:fly={flyParams[side]}
      class={cn(
        "fixed z-[100] gap-4 bg-background p-6 shadow-lg transition ease-in-out",
        sideClasses[side],
        className
      )}
    >
      {@render children?.()}
      <button
        type="button"
        class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        onclick={() => { open = false; onclose?.(); }}
      >
        <X class="h-4 w-4" />
        <span class="sr-only">Close</span>
      </button>
    </div>
  </div>
{/if}
