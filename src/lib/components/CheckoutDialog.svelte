<script lang="ts">
  import { CircleCheckBig, Banknote, QrCode, CreditCard } from 'lucide-svelte'
  import { Dialog, DialogHeader, DialogTitle, Button } from '$lib/components/ui'
  import { formatCurrency, cn } from '$lib/utils'
  import { enhance } from '$app/forms'
  import { products, cart } from '$lib/stores'
  import { toast } from 'svelte-sonner'
  import {
    PAYMENT_METHOD_LABELS,
    type CartItem,
    type PaymentMethod,
  } from '$lib/types'

  interface Props {
    open: boolean
    total: number
    items: CartItem[]
    onclose: () => void
  }

  let { open = $bindable(false), total, items, onclose }: Props = $props()
  let isSubmitting = $state(false)
  let selectedPayment = $state<PaymentMethod | null>(null)

  const paymentOptions: {
    value: PaymentMethod
    label: string
    icon: typeof Banknote
  }[] = [
    { value: 'cash', label: PAYMENT_METHOD_LABELS.cash, icon: Banknote },
    { value: 'pix', label: PAYMENT_METHOD_LABELS.pix, icon: QrCode },
    {
      value: 'debit_card',
      label: PAYMENT_METHOD_LABELS.debit_card,
      icon: CreditCard,
    },
    {
      value: 'credit_card',
      label: PAYMENT_METHOD_LABELS.credit_card,
      icon: CreditCard,
    },
  ]

  $effect(() => {
    if (open) {
      selectedPayment = null
    }
  })

  function handleClose() {
    open = false
    onclose()
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-sm">
  <DialogHeader class="items-center text-center">
    <div
      class="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-success/10"
    >
      <CircleCheckBig class="h-8 w-8 text-success" />
    </div>
    <DialogTitle class="text-xl">Confirmar Venda</DialogTitle>
    <div class="space-y-1 text-sm text-muted-foreground">
      <p class="mt-3 text-2xl font-bold text-foreground">
        {formatCurrency(total)}
      </p>
    </div>
  </DialogHeader>

  <!-- Payment Method Selection -->
  <div class="space-y-2 pt-2">
    <p class="text-sm font-medium text-center">Forma de pagamento</p>
    <div class="grid grid-cols-2 gap-2">
      {#each paymentOptions as option (option.value)}
        <button
          type="button"
          onclick={() => (selectedPayment = option.value)}
          class={cn(
            'flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-colors',
            selectedPayment === option.value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-muted-foreground/50',
          )}
        >
          <option.icon class="h-4 w-4 shrink-0" />
          <span class="truncate">{option.label}</span>
        </button>
      {/each}
    </div>
  </div>

  <form
    method="POST"
    action="?/processSale"
    use:enhance={() => {
      isSubmitting = true

      return async ({ result, update }) => {
        isSubmitting = false

        if (result.type === 'success') {
          const data = result.data as {
            success: boolean
            error?: string
            sale?: { total: number }
          }
          if (data?.success) {
            items.forEach((item) => {
              products.decrementStock(item.product.id, item.quantity)
            })
            cart.clear()
            toast.success('Venda concluída com sucesso!', {
              description: `Total: ${formatCurrency(data.sale?.total ?? 0)}`,
            })
            open = false
          } else if (data?.error) {
            toast.error('Erro', {
              description: data.error,
            })
          }
        } else if (result.type === 'failure') {
          const data = result.data as { error?: string }
          toast.error('Erro', {
            description: data?.error || 'Ocorreu um erro ao processar a venda',
          })
        }

        await update()
      }
    }}
    class="flex gap-3 pt-4"
  >
    <input type="hidden" name="items" value={JSON.stringify(items)} />
    <input type="hidden" name="total" value={total} />
    <input type="hidden" name="paymentMethod" value={selectedPayment ?? ''} />

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
      class="touch-target flex-1 bg-success hover:bg-success/90"
      disabled={isSubmitting || !selectedPayment}
    >
      {#if isSubmitting}
        Processando...
      {:else}
        Completar Venda
      {/if}
    </Button>
  </form>
</Dialog>
