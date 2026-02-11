<script lang="ts">
  import { formatCurrency, formatDate } from "$lib/utils";
  import { ArrowLeft, Receipt, Package } from "lucide-svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  const filters = [
    { value: "all", label: "Tudo" },
    { value: "today", label: "Hoje" },
    { value: "week", label: "7 dias" },
    { value: "month", label: "Mês" },
  ] as const;

  function setFilter(filterValue: string) {
    const url = new URL($page.url);
    if (filterValue === "all") {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", filterValue);
    }
    goto(url.toString(), { replaceState: true });
  }
</script>

<svelte:head>
  <title>Histórico de Vendas - Auto POS</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20">
  <!-- Header -->
  <header class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="flex h-14 items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <a href="/" class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground">
          <ArrowLeft class="h-5 w-5" />
        </a>
        <h1 class="text-lg font-semibold">Histórico de Vendas</h1>
      </div>
      <div class="text-sm text-muted-foreground">
        {data.sales.length} {data.sales.length === 1 ? 'venda' : 'vendas'}
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="flex items-center gap-2 border-t border-border px-4 py-2">
      {#each filters as filter}
        <button
          onclick={() => setFilter(filter.value)}
          class="rounded-full px-3 py-1 text-xs font-medium transition-colors {data.filter === filter.value || (data.filter === 'all' && filter.value === 'all')
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
        >
          {filter.label}
        </button>
      {/each}
    </div>

    <!-- Total Revenue -->
    {#if data.totalRevenue > 0}
      <div class="border-t border-border bg-muted/50 px-4 py-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Total do período</span>
          <span class="text-lg font-bold text-primary">{formatCurrency(data.totalRevenue)}</span>
        </div>
      </div>
    {/if}
  </header>

  <!-- Sales List -->
  <div class="p-4 space-y-4">
    {#if data.sales.length === 0}
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-4 rounded-full bg-muted p-4">
          <Receipt class="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 class="mb-1 text-lg font-semibold">Nenhuma venda</h3>
        <p class="text-sm text-muted-foreground">As vendas aparecerão aqui</p>
      </div>
    {:else}
      {#each data.sales as sale (sale.id)}
        <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
          <!-- Sale Header -->
          <div class="flex items-center justify-between border-b border-border p-4">
            <div class="flex items-center gap-2">
              <Receipt class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">
                {formatDate(sale.created_at)}
              </span>
            </div>
            <span class="text-lg font-bold text-primary">
              {formatCurrency(sale.total)}
            </span>
          </div>

          <!-- Sale Items -->
          <div class="p-4">
            {#if sale.sale_items && sale.sale_items.length > 0}
              <div class="space-y-2">
                {#each sale.sale_items as item (item.id)}
                  <div class="flex items-center justify-between text-sm">
                    <div class="flex items-center gap-2">
                      <Package class="h-3 w-3 text-muted-foreground" />
                      <span class="font-medium">
                        {item.product?.name || 'Produto'}
                      </span>
                      <span class="text-muted-foreground">×{item.quantity}</span>
                    </div>
                    <span class="tabular-nums">
                      {formatCurrency(item.price_at_sale * item.quantity)}
                    </span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-muted-foreground">Nenhum item encontrado</p>
            {/if}
          </div>

          <!-- Sale Footer -->
          <div class="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-2">
            <span class="text-xs text-muted-foreground">
              {sale.sale_items?.length || 0} {sale.sale_items?.length === 1 ? 'item' : 'itens'}
            </span>
            <span class="text-xs text-muted-foreground font-mono">
              #{sale.id.slice(0, 8)}
            </span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>


