<script lang="ts">
  import { Minus, Plus, Trash2 } from 'lucide-svelte'
  import {
    Sheet,
    SheetHeader,
    SheetTitle,
    Button,
    Separator,
    Input,
  } from '$lib/components/ui'
  import {
    formatCurrency,
    formatPricePerUnit,
    formatQuantity,
  } from '$lib/utils'
  import type { CartItem } from '$lib/types'
  import { UNIT_ALLOWS_FRACTIONS } from '$lib/constants'

  interface Props {
    open: boolean
    items: CartItem[]
    total: number
    onupdatequantity: (productId: string, quantity: number) => void
    onremoveitem: (productId: string) => void
    oncheckout: () => void
    onclose: () => void
  }

  let {
    open = $bindable(false),
    items,
    total,
    onupdatequantity,
    onremoveitem,
    oncheckout,
    onclose,
  }: Props = $props()

  function handleClose() {
    open = false
    onclose()
  }
</script>

<Sheet bind:open onclose={handleClose} class="flex w-full flex-col sm:max-w-md">
  <SheetHeader>
    <SheetTitle>Seu carrinho</SheetTitle>
  </SheetHeader>

  {#if items.length === 0}
    <div
      class="flex flex-1 flex-col items-center justify-center text-center py-16"
    >
      <p class="text-muted-foreground">Seu carrinho está vazio</p>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto -mx-6 px-6">
      <div class="space-y-4 py-4">
        {#each items as item (item.product.id)}
          <div class="flex gap-4">
            <div class="flex-1 min-w-0">
              <h4 class="font-medium truncate">{item.product.name}</h4>
              <p class="text-sm text-muted-foreground">
                {formatQuantity(item.quantity, item.product.unit)} × {formatPricePerUnit(
                  item.product.price,
                  item.product.unit,
                )} = {formatCurrency(item.quantity * item.product.price)}
              </p>
            </div>

            <div class="flex items-center gap-2">
              {#if UNIT_ALLOWS_FRACTIONS[item.product.unit]}
                <div class="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max={item.product.stock}
                    value={item.quantity}
                    onchange={(e) => {
                      const val = parseFloat(e.currentTarget.value)
                      if (val > 0 && val <= item.product.stock) {
                        onupdatequantity(item.product.id, val)
                      }
                    }}
                    class="h-9 w-24 text-center"
                  />
                  <span class="text-sm text-muted-foreground"
                    >{item.product.unit}</span
                  >
                </div>
              {:else}
                <div
                  class="flex items-center gap-1 rounded-lg border border-border"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-9 w-9"
                    onclick={() =>
                      onupdatequantity(item.product.id, item.quantity - 1)}
                  >
                    <Minus class="h-4 w-4" />
                  </Button>
                  <span class="min-w-8 text-center font-medium">
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-9 w-9"
                    onclick={() =>
                      onupdatequantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                  >
                    <Plus class="h-4 w-4" />
                  </Button>
                </div>
              {/if}

              <Button
                variant="ghost"
                size="icon"
                class="h-9 w-9 text-destructive hover:text-destructive"
                onclick={() => onremoveitem(item.product.id)}
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="space-y-4 pt-4">
      <Separator />
      <div class="flex items-center justify-between">
        <span class="text-lg font-semibold">Total</span>
        <span class="text-2xl font-bold">{formatCurrency(total)}</span>
      </div>
      <Button
        size="lg"
        class="touch-target w-full text-lg"
        onclick={oncheckout}
      >
        Finalizar venda
      </Button>
    </div>
  {/if}
</Sheet>
