<script lang="ts">
  import { Package, ShoppingCart, Sun, Moon } from "lucide-svelte";
  import { cn } from "$lib/utils";
  import { toggleMode, mode } from "mode-watcher";

  interface Props {
    activeTab: "inventory" | "sales";
    ontabchange: (tab: "inventory" | "sales") => void;
  }

  let { activeTab, ontabchange }: Props = $props();
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
  <div class="mx-auto flex max-w-lg items-center justify-around px-4 py-2">
    <button
      onclick={() => ontabchange("inventory")}
      class={cn(
        "flex min-h-[44px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors",
        activeTab === "inventory"
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Package class="h-5 w-5" />
      <span class="text-xs font-medium">Produtos</span>
    </button>

    <button
      onclick={() => ontabchange("sales")}
      class={cn(
        "flex min-h-[44px] min-w-[72px] flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors",
        activeTab === "sales"
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <ShoppingCart class="h-5 w-5" />
      <span class="text-xs font-medium">Vendas</span>
    </button>

    <button
      onclick={toggleMode}
      class="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Toggle theme"
    >
      {#if $mode === "dark"}
        <Sun class="h-5 w-5" />
      {:else}
        <Moon class="h-5 w-5" />
      {/if}
    </button>
  </div>
</nav>
