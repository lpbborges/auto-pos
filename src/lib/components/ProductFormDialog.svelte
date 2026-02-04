<script lang="ts">
  import { Dialog, DialogHeader, DialogTitle, Button, Input } from "$lib/components/ui";
  import type { Product } from "$lib/types";

  interface Props {
    open: boolean;
    product?: Product | null;
    onsubmit: (data: { name: string; price: number; stock: number }) => void;
    onclose: () => void;
  }

  let { open = $bindable(false), product = null, onsubmit, onclose }: Props = $props();

  let name = $state("");
  let price = $state(0);
  let stock = $state(0);
  let errors = $state<{ name?: string; price?: string; stock?: string }>({});

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
      errors.name = "Name is required";
    }
    if (price <= 0) {
      errors.price = "Price must be greater than 0";
    }
    if (stock < 0) {
      errors.stock = "Stock cannot be negative";
    }
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (validate()) {
      onsubmit({ name: name.trim(), price, stock });
      open = false;
    }
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

  <form onsubmit={handleSubmit} class="space-y-4 mt-4">
    <div class="space-y-2">
      <label for="name" class="text-sm font-medium">Product Name</label>
      <Input
        id="name"
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
      >
        Cancelar
      </Button>
      <Button type="submit" class="touch-target flex-1">
        {product ? "Salvar Alterações" : "Adicionar Produto"}
      </Button>
    </div>
  </form>
</Dialog>
