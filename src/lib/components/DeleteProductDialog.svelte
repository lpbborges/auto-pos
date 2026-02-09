<script lang="ts">
  import { Dialog, DialogHeader, DialogTitle, DialogDescription, Button } from "$lib/components/ui";
  import { enhance } from "$app/forms";
  import { products } from "$lib/stores";
  import { toast } from "svelte-sonner";
  import type { Product } from "$lib/types";

  interface Props {
    open: boolean;
    product: Product | null;
    onclose: () => void;
  }

  let { open = $bindable(false), product, onclose }: Props = $props();
  let isSubmitting = $state(false);

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-md">
  <DialogHeader>
    <DialogTitle>Excluir Produto</DialogTitle>
    <DialogDescription>
      Tem certeza que deseja excluir <strong>{product?.name}</strong>? Essa ação não pode ser desfeita.
    </DialogDescription>
  </DialogHeader>

  <form
    method="POST"
    action="?/deleteProduct"
    use:enhance={() => {
      isSubmitting = true;
      
      return async ({ result, update }) => {
        isSubmitting = false;
        
        if (result.type === "success") {
          const data = result.data as { success: boolean; error?: string };
          if (data?.success && product) {
            products.delete(product.id);
            toast.success("Produto excluído");
            open = false;
          } else if (data?.error) {
            toast.error("Erro", {
              description: data.error,
            });
          }
        } else if (result.type === "failure") {
          const data = result.data as { error?: string };
          toast.error("Erro", {
            description: data?.error || "Ocorreu um erro",
          });
        }
        
        await update();
      };
    }}
    class="flex flex-col gap-2 pt-4 sm:flex-row"
  >
    {#if product}
      <input type="hidden" name="id" value={product.id} />
    {/if}
    
    <Button type="button" variant="outline" onclick={handleClose} class="touch-target flex-1" disabled={isSubmitting}>
      Cancelar
    </Button>
    <Button
      type="submit"
      class="touch-target flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
      disabled={isSubmitting}
    >
      {#if isSubmitting}
        Excluindo...
      {:else}
        Deletar
      {/if}
    </Button>
  </form>
</Dialog>
