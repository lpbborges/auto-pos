import { writable, derived } from 'svelte/store'
import type { Product, CartItem } from '$lib/types'

function createCartStore() {
  const { subscribe, set, update } = writable<CartItem[]>([])

  return {
    subscribe,
    add: (product: Product, quantity: number = 1) => {
      update((items) => {
        const existing = items.find((item) => item.product.id === product.id)
        if (existing) {
          return items.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        }
        return [...items, { product, quantity }]
      })
    },
    remove: (productId: string) => {
      update((items) => items.filter((item) => item.product.id !== productId))
    },
    updateQuantity: (productId: string, quantity: number) => {
      if (quantity <= 0) {
        update((items) => items.filter((item) => item.product.id !== productId))
      } else {
        update((items) =>
          items.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item,
          ),
        )
      }
    },
    clear: () => set([]),
  }
}

export const cart = createCartStore()

export const cartTotal = derived(
  cart,
  ($cart) =>
    Math.round(
      $cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0) *
        100,
    ) / 100,
)

export const cartItemCount = derived(cart, ($cart) =>
  $cart.reduce((sum, item) => sum + item.quantity, 0),
)
