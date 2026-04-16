<script lang="ts">
  import { formatCurrency, formatDate, formatDateOnly } from '$lib/utils'
  import {
    ArrowLeft,
    Receipt,
    Package,
    TrendingUp,
    RotateCcw,
    AlertTriangle,
  } from 'lucide-svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { enhance } from '$app/forms'
  import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '$lib/types'
  import type { PageData } from './$types'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()

  let undoingSaleId = $state<string | null>(null)
  let undoDialogOpen = $state(false)
  let saleToUndo = $state<string | null>(null)
  let undoing = $state(false)

  const filters = [
    { value: 'all', label: 'Tudo' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: '7 dias' },
    { value: 'month', label: 'Mês' },
  ] as const

  function setFilter(filterValue: string) {
    const url = new URL($page.url)
    if (filterValue === 'all') {
      url.searchParams.delete('filter')
    } else {
      url.searchParams.set('filter', filterValue)
    }
    goto(url.toString(), { replaceState: true })
  }

  function getPaymentLabel(method: string): string {
    return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method
  }

  function openUndoDialog(saleId: string) {
    saleToUndo = saleId
    undoDialogOpen = true
  }

  function closeUndoDialog() {
    undoDialogOpen = false
    saleToUndo = null
  }

  async function handleUndo() {
    if (!saleToUndo) return
    undoing = true
    undoingSaleId = saleToUndo
  }
</script>

<svelte:head>
  <title>Histórico de Vendas - Auto POS</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20">
  <!-- Header -->
  <header
    class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
  >
    <div class="flex h-14 items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <a
          href="/"
          class="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft class="h-5 w-5" />
        </a>
        <h1 class="text-lg font-semibold">Histórico de Vendas</h1>
      </div>
      <div class="text-sm text-muted-foreground">
        {data.sales.length}
        {data.sales.length === 1 ? 'venda' : 'vendas'}
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="flex items-center gap-2 border-t border-border px-4 py-2">
      {#each filters as filter (filter.value)}
        <button
          onclick={() => setFilter(filter.value)}
          class="rounded-full px-3 py-1 text-xs font-medium transition-colors {data.filter ===
            filter.value ||
          (data.filter === 'all' && filter.value === 'all')
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'}"
        >
          {filter.label}
        </button>
      {/each}
    </div>

    <!-- Total Revenue & Profit -->
    {#if data.totalRevenue > 0}
      <div class="border-t border-border bg-muted/50 px-4 py-2">
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">Faturamento</span>
          <span class="text-lg font-bold text-primary"
            >{formatCurrency(data.totalRevenue)}</span
          >
        </div>
        <div class="flex items-center justify-between mt-1">
          <span class="text-sm text-muted-foreground flex items-center gap-1">
            <TrendingUp class="h-3 w-3" />
            Lucro
          </span>
          <span class="text-lg font-bold text-green-600 dark:text-green-400"
            >{formatCurrency(data.totalProfit)}</span
          >
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
          <div
            class="flex items-center justify-between border-b border-border p-4"
          >
            <div class="flex items-center gap-2">
              <Receipt class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">
                {sale.sold_at
                  ? formatDateOnly(sale.sold_at)
                  : formatDate(sale.created_at)}
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
                      <span class="text-muted-foreground"
                        >&times;{item.quantity}</span
                      >
                    </div>
                    <span class="tabular-nums">
                      {formatCurrency(item.price_at_sale * item.quantity)}
                    </span>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-muted-foreground">
                Nenhum item encontrado
              </p>
            {/if}
          </div>

          <!-- Sale Footer -->
          <div
            class="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-2"
          >
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground">
                {sale.sale_items?.length || 0}
                {sale.sale_items?.length === 1 ? 'item' : 'itens'}
              </span>
              {#if sale.payment_method}
                <span
                  class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {getPaymentLabel(sale.payment_method)}
                </span>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              {#if sale.profit != null}
                <span
                  class="text-xs font-medium text-green-600 dark:text-green-400"
                >
                  Lucro: {formatCurrency(sale.profit)}
                </span>
              {/if}
              <span class="text-xs text-muted-foreground font-mono">
                #{sale.id.slice(0, 8)}
              </span>
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground disabled:opacity-50"
                title="Cancelar venda"
                disabled={undoing && undoingSaleId === sale.id}
                onclick={() => openUndoDialog(sale.id)}
              >
                <RotateCcw class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Undo Confirmation Dialog -->
  {#if undoDialogOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <button
        type="button"
        class="fixed inset-0 bg-black/80"
        onclick={closeUndoDialog}
        aria-label="Close dialog"
      ></button>

      <!-- Content -->
      <div
        class="relative z-[100] grid w-full max-w-sm gap-4 border bg-background p-6 shadow-lg sm:rounded-lg"
      >
        <div class="flex flex-col items-center text-center">
          <div
            class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"
          >
            <AlertTriangle class="h-6 w-6 text-destructive" />
          </div>
          <h3 class="text-lg font-semibold">Cancelar Venda?</h3>
          <p class="mt-2 text-sm text-muted-foreground">
            Esta ação irá restaurar o estoque dos produtos vendidos. Esta ação
            não pode ser desfeita.
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <form
            method="POST"
            action="?/undoSale"
            use:enhance={() => {
              handleUndo()
              return async ({ update }) => {
                await update()
                undoing = false
                undoingSaleId = null
                closeUndoDialog()
              }
            }}
          >
            <input type="hidden" name="saleId" value={saleToUndo ?? ''} />
            <button
              type="submit"
              class="inline-flex h-10 w-full items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              disabled={undoing}
            >
              {undoing ? 'Cancelando...' : 'Sim, cancelar venda'}
            </button>
          </form>
          <button
            type="button"
            class="inline-flex h-10 w-full items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            onclick={closeUndoDialog}
            disabled={undoing}
          >
            Não, manter venda
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
