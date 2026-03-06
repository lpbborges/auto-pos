export interface Store {
  id: string
  name: string
  createdAt: string
}

export interface UserStoreMembership {
  id: string
  userId: string
  storeId: string
  createdAt: string
}

import type { ProductUnit } from './constants'

export interface Product {
  id: string
  name: string
  price: number
  stock: number
  unit: ProductUnit
  storeId: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface CartItem {
  product: Product
  quantity: number
}

export type PaymentMethod = 'cash' | 'pix' | 'debit_card' | 'credit_card'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
}

export interface Sale {
  id: string
  items: CartItem[]
  total: number
  paymentMethod: PaymentMethod
  createdAt: string
}

export type StockMovementType = 'in' | 'out'

export interface StockMovement {
  id: string
  productId: string
  storeId: string
  type: StockMovementType
  quantity: number
  unitCost: number | null
  reason: string | null
  saleId: string | null
  createdAt: string
  product?: { name: string }
}
