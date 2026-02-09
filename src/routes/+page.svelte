<script lang="ts">
  import { BottomNav, InventoryView, SalesView } from "$lib/components";
  import { products } from "$lib/stores";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  // Initialize products store with server data
  $effect(() => {
    if (data.products) {
      products.set(data.products);
    }
  });

  let activeTab = $state<"inventory" | "sales">("inventory");
</script>

<svelte:head>
  <title>Auto POS</title>
  <meta name="description" content="Point of Sale System" />
</svelte:head>

<div class="min-h-screen bg-background">
  {#if activeTab === "inventory"}
    <InventoryView />
  {:else}
    <SalesView />
  {/if}

  <BottomNav {activeTab} ontabchange={(tab) => (activeTab = tab)} />
</div>
