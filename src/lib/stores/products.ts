import { writable, derived } from "svelte/store";
import type { Product } from "$lib/types";

function createProductsStore(initialProducts: Product[] = []) {
  const { subscribe, set, update } = writable<Product[]>(initialProducts);

  return {
    subscribe,
    set,
    update,
    add: (product: Product) => {
      update((products) => [product, ...products]);
    },
    updateProduct: (updatedProduct: Product) => {
      update((products) =>
        products.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
    },
    delete: (id: string) => {
      update((products) => products.filter((p) => p.id !== id));
    },
    decrementStock: (id: string, quantity: number) => {
      update((products) =>
        products.map((p) =>
          p.id === id ? { ...p, stock: Math.max(0, p.stock - quantity) } : p
        )
      );
    },
  };
}

export const products = createProductsStore();
export const searchQuery = writable("");

export const filteredProducts = derived(
  [products, searchQuery],
  ([$products, $searchQuery]) =>
    $products.filter((p) =>
      p.name.toLowerCase().includes($searchQuery.toLowerCase())
    )
);

export const availableProducts = derived(filteredProducts, ($filtered) =>
  $filtered.filter((p) => p.stock > 0)
);
