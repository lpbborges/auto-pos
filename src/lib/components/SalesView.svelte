<script lang="ts">
  import { Search, ShoppingCart, Receipt } from "lucide-svelte";
  import { Input, Button, Card, CardContent, Badge } from "$lib/components/ui";
  import PageHeader from "./PageHeader.svelte";
  import CartSheet from "./CartSheet.svelte";
  import CheckoutDialog from "./CheckoutDialog.svelte";
  import { cn, formatCurrency } from "$lib/utils";
  import { availableProducts, searchQuery, cart, cartTotal, cartItemCount } from "$lib/stores";
  import type { Product } from "$lib/types";

  let isCartOpen = $state(false);
  let isCheckoutOpen = $state(false);

  function handleCheckout() {
    isCartOpen = false;
    isCheckoutOpen = true;
  }

  function getCartQuantity(productId: string): number {
    const item = $cart.find((i) => i.product.id === productId);
    return item?.quantity || 0;
  }

  function handleAddToCart(product: Product) {
    const cartQty = getCartQuantity(product.id);
    if (product.stock > cartQty) {
      cart.add(product);
    }
  }
</script>

<div class="flex min-h-screen flex-col pb-36">
  <PageHeader title="Vendas">
    <div class="flex items-center gap-2">
      <a
        href="/sales"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        title="Histórico de vendas"
      >
        <Receipt class="h-5 w-5" />
      </a>
      <Button
        variant="outline"
        size="sm"
        onclick={() => (isCartOpen = true)}
        class="touch-target relative gap-2"
      >
        <ShoppingCart class="h-4 w-4" />
        <span class="hidden sm:inline">Carrinho</span>
        {#if $cartItemCount > 0}
          <Badge class="absolute -right-2 -top-2 h-5 min-w-[20px] rounded-full px-1.5 text-xs">
            {$cartItemCount}
          </Badge>
        {/if}
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

  <!-- Product Grid -->
  <div class="flex-1 overflow-auto p-4">
    {#if $availableProducts.length === 0}
      <div class="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div class="mb-4 rounded-full bg-muted p-4">
          <ShoppingCart class="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 class="mb-1 text-lg font-semibold">Nenhum produto encontrado</h3>
        <p class="text-sm text-muted-foreground">
          {$searchQuery ? "Tente uma pesquisa diferente" : "Adicione produtos no estoque"}
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {#each $availableProducts as product (product.id)}
          {@const cartQty = getCartQuantity(product.id)}
          {@const isOutOfStock = product.stock === 0}
          {@const isLowStock = product.stock > 0 && product.stock <= cartQty}

          <button
            type="button"
            class={cn(
              "animate-scale-in cursor-pointer overflow-hidden transition-all hover:shadow-md active:scale-[0.98] text-left",
              isOutOfStock && "opacity-50",
              cartQty > 0 && "ring-2 ring-primary"
            )}
            onclick={() => !isOutOfStock && !isLowStock && handleAddToCart(product)}
            disabled={isOutOfStock || isLowStock}
          >
            <Card class="h-full">
              <CardContent class="flex h-full min-h-[120px] flex-col justify-between p-3">
                <div>
                  <h3 class="line-clamp-2 text-sm font-semibold leading-tight">
                    {product.name}
                  </h3>
                  <p class="mt-1 text-lg font-bold text-primary">
                    {formatCurrency(product.price)}
                  </p>
                </div>
                <div class="mt-2 flex items-center justify-between">
                  <span
                    class={cn(
                      "text-xs",
                      isOutOfStock
                        ? "font-medium text-destructive"
                        : isLowStock
                          ? "font-medium text-accent-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {isOutOfStock
                      ? "Sem estoque"
                      : isLowStock
                        ? "Limite de estoque alcançado"
                        : `${product.stock} restantes`}
                  </span>
                  {#if cartQty > 0}
                    <Badge variant="secondary" class="text-xs">
                      ×{cartQty}
                    </Badge>
                  {/if}
                </div>
              </CardContent>
            </Card>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Cart Summary Bar -->
  {#if $cartItemCount > 0}
    <div class="fixed bottom-20 left-0 right-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm">
      <div class="mx-auto flex max-w-lg items-center justify-between">
        <div>
          <p class="text-sm text-muted-foreground">
            {$cartItemCount} {$cartItemCount === 1 ? "item" : "itens"}
          </p>
          <p class="text-xl font-bold">{formatCurrency($cartTotal)}</p>
        </div>
        <Button
          size="lg"
          onclick={() => (isCartOpen = true)}
          class="touch-target gap-2 px-6"
        >
          <ShoppingCart class="h-4 w-4" />
          Ver carrinho
        </Button>
      </div>
    </div>
  {/if}

  <!-- Cart Sheet -->
  <CartSheet
    bind:open={isCartOpen}
    items={$cart}
    total={$cartTotal}
    onupdatequantity={(id, qty) => cart.updateQuantity(id, qty)}
    onremoveitem={(id) => cart.remove(id)}
    oncheckout={handleCheckout}
    onclose={() => (isCartOpen = false)}
  />

  <!-- Checkout Dialog -->
  <CheckoutDialog
    bind:open={isCheckoutOpen}
    total={$cartTotal}
    itemCount={$cartItemCount}
    items={$cart}
    onclose={() => (isCheckoutOpen = false)}
  />
</div>
