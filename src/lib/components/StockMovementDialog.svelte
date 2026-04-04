<script lang="ts">
  import {
    Dialog,
    DialogHeader,
    DialogTitle,
    Button,
    Input,
  } from '$lib/components/ui'
  import { cn, formatQuantity } from '$lib/utils'
  import type { Product, StockMovementType } from '$lib/types'
  import { enhance } from '$app/forms'
  import { products } from '$lib/stores'
  import { toast } from 'svelte-sonner'
  import { UNIT_ALLOWS_FRACTIONS } from '$lib/constants'

  interface Props {
    open: boolean
    product: Product | null
    onclose: () => void
  }

  let { open = $bindable(false), product, onclose }: Props = $props()

  let movementType = $state<StockMovementType>('in')
  let quantity = $state(1)
  let unitCost = $state(0)
  let reason = $state('')
  let isSubmitting = $state(false)
  let currentStock = $state(0)

  $effect(() => {
    if (open) {
      movementType = 'in'
      quantity = 1
      unitCost = 0
      reason = ''
      currentStock = product?.stock ?? 0
    }
  })

  function handleClose() {
    open = false
    onclose()
  }

  const formAction = $derived(
    movementType === 'in' ? '?/createStockIn' : '?/createStockOut',
  )

  function getQuantityStep(): string {
    if (product && UNIT_ALLOWS_FRACTIONS[product.unit]) {
      return '0.001'
    }
    return '1'
  }

  function getQuantityMin(): string {
    if (product && UNIT_ALLOWS_FRACTIONS[product.unit]) {
      return '0.001'
    }
    return '1'
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-md">
  <DialogHeader>
    <DialogTitle>Movimentação de Estoque</DialogTitle>
    {#if product}
      <p class="text-sm text-muted-foreground">
        {product.name} — Estoque atual: {formatQuantity(
          product.stock,
          product.unit,
        )}
      </p>
    {/if}
  </DialogHeader>

  <!-- Movement Type Toggle -->
  <div class="grid grid-cols-2 gap-2 mt-4">
    <button
      type="button"
      onclick={() => (movementType = 'in')}
      class={cn(
        'rounded-lg border-2 p-3 text-sm font-medium transition-colors',
        movementType === 'in'
          ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-400'
          : 'border-border hover:border-muted-foreground/50',
      )}
    >
      Entrada
    </button>
    <button
      type="button"
      onclick={() => (movementType = 'out')}
      class={cn(
        'rounded-lg border-2 p-3 text-sm font-medium transition-colors',
        movementType === 'out'
          ? 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-400'
          : 'border-border hover:border-muted-foreground/50',
      )}
    >
      Saída
    </button>
  </div>

  <form
    method="POST"
    action={formAction}
    use:enhance={() => {
      isSubmitting = true

      return async ({ result, update }) => {
        isSubmitting = false

        if (result.type === 'success') {
          const data = result.data as { success: boolean; error?: string }
          if (data?.success && product) {
            products.updateProduct({
              ...product,
              stock:
                currentStock + (movementType === 'in' ? quantity : -quantity),
            })
            toast.success(
              movementType === 'in' ? 'Entrada registrada' : 'Saída registrada',
              {
                description: `${quantity} unidade(s) — ${product.name}`,
              },
            )
            open = false
          } else if (data?.error) {
            toast.error('Erro', { description: data.error })
          }
        } else if (result.type === 'failure') {
          const data = result.data as { error?: string }
          toast.error('Erro', {
            description: data?.error || 'Ocorreu um erro',
          })
        }

        await update()
      }
    }}
    class="space-y-4 mt-4"
  >
    <input type="hidden" name="productId" value={product?.id ?? ''} />

    <div class="space-y-2">
      <label for="quantity" class="text-sm font-medium"
        >Quantidade ({product?.unit})</label
      >
      <Input
        id="quantity"
        name="quantity"
        type="number"
        step={getQuantityStep()}
        min={getQuantityMin()}
        max={movementType === 'out' ? (product?.stock ?? 0) : undefined}
        placeholder="0"
        class="touch-target"
        bind:value={quantity}
      />
    </div>

    {#if movementType === 'in'}
      <div class="space-y-2">
        <label for="unitCost" class="text-sm font-medium"
          >Custo Unitário (R$)</label
        >
        <Input
          id="unitCost"
          name="unitCost"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          class="touch-target"
          bind:value={unitCost}
        />
      </div>
    {/if}

    <div class="space-y-2">
      <label for="reason" class="text-sm font-medium">Motivo (opcional)</label>
      <Input
        id="reason"
        name="reason"
        placeholder={movementType === 'in'
          ? 'Ex: Compra fornecedor'
          : 'Ex: Avaria, perda'}
        class="touch-target"
        bind:value={reason}
      />
    </div>

    <div class="flex gap-3 pt-2">
      <Button
        type="button"
        variant="outline"
        onclick={handleClose}
        class="touch-target flex-1"
        disabled={isSubmitting}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        class="touch-target flex-1"
        disabled={isSubmitting ||
          quantity <= 0 ||
          (movementType === 'in' && unitCost < 0)}
      >
        {#if isSubmitting}
          Salvando...
        {:else}
          Registrar {movementType === 'in' ? 'Entrada' : 'Saída'}
        {/if}
      </Button>
    </div>
  </form>
</Dialog>
