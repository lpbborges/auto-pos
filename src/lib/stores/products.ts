import { writable, derived } from "svelte/store";
import type { Product } from "$lib/types";
import { browser } from "$app/environment";

const STORAGE_KEY = "pos_products";

function getStoredProducts(): Product[] {
  if (!browser) return [];

  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }

  return [];
}

function createProductsStore() {
  const { subscribe, set, update } = writable<Product[]>(getStoredProducts());

  if (browser) {
    subscribe((products) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    });
  }

  return {
    subscribe,
    set,
    add: (data: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
      const newProduct: Product = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      update((products) => [...products, newProduct]);

      return newProduct;
    },
    update: (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      update((products) =>
        products.map((p) =>
          p.id === id
            ? { ...p, ...data, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    delete: (id: string) => {
      update((products) => products.filter((p) => p.id !== id));
    },
    decrementStock: (id: string, quantity: number) => {
      update((products) =>
        products.map((p) =>
          p.id === id
            ? {
                ...p,
                stock: Math.max(0, p.stock - quantity),
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
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
      p.name.toLowerCase().includes($searchQuery.toLowerCase()),
    ),
);

export const availableProducts = derived(filteredProducts, ($filtered) =>
  $filtered.filter((p) => p.stock > 0),
);
