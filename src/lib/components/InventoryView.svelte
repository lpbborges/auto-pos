<script lang="ts">
  import { Search, Plus, Pencil, Trash2, Package, Receipt } from "lucide-svelte";
  import { Input, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "$lib/components/ui";
  import PageHeader from "./PageHeader.svelte";
  import ProductFormDialog from "./ProductFormDialog.svelte";
  import DeleteProductDialog from "./DeleteProductDialog.svelte";
  import { formatCurrency } from "$lib/utils";
  import { filteredProducts, searchQuery } from "$lib/stores";
  import type { Product } from "$lib/types";

  let isAddDialogOpen = $state(false);
  let isUpdateDialogOpen = $state(false);
  let editingProduct = $state<Product | null>(null);
  let isDeleteDialogOpen = $state(false);
  let deletingProduct = $state<Product | null>(null);

  function triggerUpdate(product: Product) {
    editingProduct = product;
    isUpdateDialogOpen = true;
  }

  function triggerDelete(product: Product) {
    deletingProduct = product;
    isDeleteDialogOpen = true;
  }
</script>

<div class="flex min-h-screen flex-col pb-20">
  <PageHeader title="Produtos">
    <div class="flex items-center gap-2">
      <a
        href="/sales"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        title="Histórico de vendas"
      >
        <Receipt class="h-5 w-5" />
      </a>
      <Button size="sm" onclick={() => (isAddDialogOpen = true)} class="touch-target gap-2 hidden md:flex">
        <Plus class="h-4 w-4" />
        Adicionar
      </Button>
    </div>
  </PageHeader>

  <!-- Search Bar -->
  <div class="border-b border-border bg-background px-4 py-3">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Procurar produtos..."
        value={$searchQuery}
        oninput={(e) => searchQuery.set(e.currentTarget.value)}
        class="touch-target pl-10"
      />
    </div>
  </div>

  <!-- Product Table -->
  <div class="flex-1 overflow-auto">
    {#if $filteredProducts.length === 0}
      <div class="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div class="mb-4 rounded-full bg-muted p-4">
          <Package class="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 class="mb-1 text-lg font-semibold">Sem produtos</h3>
        <p class="text-sm text-muted-foreground">
          {$searchQuery ? "Try a different search term" : "Adicione um produto para começar"}
        </p>
      </div>
    {:else}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="font-semibold">Nome</TableHead>
            <TableHead class="text-right font-semibold">Quantidade</TableHead>
            <TableHead class="text-right font-semibold">Preço</TableHead>
            <TableHead class="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each $filteredProducts as product (product.id)}
            <TableRow class="animate-fade-in">
              <TableCell class="font-medium">{product.name}</TableCell>
              <TableCell class="text-right">
                <span
                  class={product.stock <= 10
                    ? "font-semibold text-destructive"
                    : product.stock <= 20
                      ? "font-medium text-accent-foreground"
                      : ""}
                >
                  {product.stock}
                </span>
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {formatCurrency(product.price)}
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => triggerUpdate(product)}
                    class="h-9 w-9"
                  >
                    <Pencil class="h-4 w-4" />
                    <span class="sr-only">Editar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => triggerDelete(product)}
                    class="h-9 w-9 text-destructive hover:text-destructive"
                  >
                    <Trash2 class="h-4 w-4" />
                    <span class="sr-only">Deletar</span>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    {/if}
  </div>

  <!-- Floating Action Button (Mobile) -->
  <button
    onclick={() => (isAddDialogOpen = true)}
    class="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
    aria-label="Add product"
  >
    <Plus class="h-6 w-6" />
  </button>

  <!-- Add Product Dialog -->
  <ProductFormDialog
    bind:open={isAddDialogOpen}
    onclose={() => (isAddDialogOpen = false)}
  />

  <!-- Edit Product Dialog -->
  <ProductFormDialog
    open={isUpdateDialogOpen}
    product={editingProduct}
    onclose={() => { editingProduct = null; isUpdateDialogOpen = false; }}
  />

  <!-- Delete Confirmation Dialog -->
  <DeleteProductDialog
    bind:open={isDeleteDialogOpen}
    product={deletingProduct}
    onclose={() => { deletingProduct = null; isDeleteDialogOpen = false; }}
  />
</div>
