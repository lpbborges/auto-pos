<script lang="ts">
  import { Dialog, DialogHeader, DialogTitle, Button, Input } from "$lib/components/ui";
  import type { Product } from "$lib/types";
  import { enhance } from "$app/forms";
  import { products } from "$lib/stores";
  import { toast } from "svelte-sonner";

  interface Props {
    open: boolean;
    product?: Product | null;
    onclose: () => void;
  }

  let { open = $bindable(false), product = null, onclose }: Props = $props();

  let name = $state("");
  let price = $state(0);
  let stock = $state(0);
  let errors = $state<{ name?: string; price?: string; stock?: string }>({});
  let isSubmitting = $state(false);

  $effect(() => {
    if (open) {
      name = product?.name || "";
      price = product?.price || 0;
      stock = product?.stock || 0;
      errors = {};
    }
  });

  function validate(): boolean {
    errors = {};
    if (!name.trim()) {
      errors.name = "Nome é obrigatório";
    }
    if (price <= 0) {
      errors.price = "Preço deve ser maior que 0";
    }
    if (stock < 0) {
      errors.stock = "Estoque não pode ser negativo";
    }
    return Object.keys(errors).length === 0;
  }

  function handleClose() {
    open = false;
    onclose();
  }
</script>

<Dialog bind:open onclose={handleClose} class="max-w-[95vw] sm:max-w-md">
  <DialogHeader>
    <DialogTitle>{product ? "Editar Produto" : "Adicionar Produto"}</DialogTitle>
  </DialogHeader>

  <form
    method="POST"
    action={product ? "?/updateProduct" : "?/createProduct"}
    use:enhance={() => {
      isSubmitting = true;
      
      return async ({ result, update }) => {
        isSubmitting = false;
        
        if (result.type === "success") {
          const data = result.data as { success: boolean; product?: Product; error?: string };
          if (data?.success && data.product) {
            if (product) {
              products.updateProduct(data.product);
              toast.success("Produto atualizado");
            } else {
              products.add(data.product);
              toast.success("Produto adicionado", {
                description: `${data.product.name} adicionado ao estoque.`,
              });
            }
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
    class="space-y-4 mt-4"
  >
    {#if product}
      <input type="hidden" name="id" value={product.id} />
    {/if}
    
    <div class="space-y-2">
      <label for="name" class="text-sm font-medium">Nome do Produto</label>
      <Input
        id="name"
        name="name"
        placeholder="Nome do Produto"
        class="touch-target"
        bind:value={name}
      />
      {#if errors.name}
        <p class="text-sm text-destructive">{errors.name}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="price" class="text-sm font-medium">Preço (R$)</label>
      <Input
        id="price"
        name="price"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        class="touch-target"
        bind:value={price}
      />
      {#if errors.price}
        <p class="text-sm text-destructive">{errors.price}</p>
      {/if}
    </div>

    <div class="space-y-2">
      <label for="stock" class="text-sm font-medium">Quantidade</label>
      <Input
        id="stock"
        name="stock"
        type="number"
        min="0"
        placeholder="0"
        class="touch-target"
        bind:value={stock}
      />
      {#if errors.stock}
        <p class="text-sm text-destructive">{errors.stock}</p>
      {/if}
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
      <Button type="submit" class="touch-target flex-1" disabled={isSubmitting}>
        {#if isSubmitting}
          Salvando...
        {:else}
          {product ? "Salvar Alterações" : "Adicionar Produto"}
        {/if}
      </Button>
    </div>
  </form>
</Dialog>
