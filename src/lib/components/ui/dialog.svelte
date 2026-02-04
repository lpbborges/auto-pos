<script lang="ts">
  import { cn } from "$lib/utils";
  import { X } from "lucide-svelte";
  import type { Snippet } from "svelte";

  interface Props {
    open: boolean;
    onclose?: () => void;
    class?: string;
    children?: Snippet;
  }

  let { open = $bindable(false), onclose, class: className, children }: Props = $props();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      open = false;
      onclose?.();
    }
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
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    role="dialog"
    aria-modal="true"
  >
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 bg-black/80"
      onclick={handleBackdropClick}
      aria-label="Close dialog"
    ></button>

    <!-- Content -->
    <div
      class={cn(
        "relative z-[100] grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg",
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
