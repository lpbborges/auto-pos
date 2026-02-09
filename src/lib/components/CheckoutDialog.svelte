<script lang="ts">
  import { CheckCircle2 } from "lucide-svelte";
  import { Dialog, DialogHeader, DialogTitle, Button } from "$lib/components/ui";
  import { formatCurrency } from "$lib/utils";
  import { enhance } from "$app/forms";
  import { products, cart } from "$lib/stores";
  import { toast } from "svelte-sonner";
  import type { CartItem } from "$lib/types";

  interface Props {
    open: boolean;
    total: number;
    itemCount: number;
    items: CartItem[];
    onclose: () => void;
  }

  let { open = $bindable(false), total, itemCount, items, onclose }: Props = $props();
  let isSubmitting = $state(false);

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-sm">
  <DialogHeader class="items-center text-center">
    <div class="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
      <CheckCircle2 class="h-8 w-8 text-success" />
    </div>
    <DialogTitle class="text-xl">Confirmar Venda</DialogTitle>
    <div class="space-y-1 text-sm text-muted-foreground">
      <p>{itemCount} {itemCount === 1 ? "item" : "itens"}</p>
      <p class="text-2xl font-bold text-foreground">{formatCurrency(total)}</p>
    </div>
  </DialogHeader>

  <form
    method="POST"
    action="?/processSale"
    use:enhance={() => {
      isSubmitting = true;

      return async ({ result, update }) => {
          console.log({ result, total })
        isSubmitting = false;

        if (result.type === "success") {
          const data = result.data as { success: boolean; error?: string, sale?: { total: number } };
          if (data?.success) {
            // Update local stock
            items.forEach((item) => {
              products.decrementStock(item.product.id, item.quantity);
            });
            cart.clear();
            toast.success("Venda concluída com sucesso!", {
              description: `Total: ${formatCurrency(data.sale?.total ?? 0)}`,
            });
            open = false;
          } else if (data?.error) {
            toast.error("Erro", {
              description: data.error,
            });
          }
        } else if (result.type === "failure") {
          const data = result.data as { error?: string };
          toast.error("Erro", {
            description: data?.error || "Ocorreu um erro ao processar a venda",
          });
        }

        await update();
      };
    }}
    class="flex gap-3 pt-4"
  >
    <input type="hidden" name="items" value={JSON.stringify(items)} />
    <input type="hidden" name="total" value={total} />

    <Button type="button" variant="outline" onclick={handleClose} class="touch-target flex-1" disabled={isSubmitting}>
      Cancelar
    </Button>
    <Button
      type="submit"
      class="touch-target flex-1 bg-success hover:bg-success/90"
      disabled={isSubmitting}
    >
      {#if isSubmitting}
        Processando...
      {:else}
        Completar Venda
      {/if}
    </Button>
  </form>
</Dialog>
