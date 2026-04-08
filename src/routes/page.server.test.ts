import { describe, it, expect, vi, beforeEach } from 'vitest'
import { actions } from './+page.server'
import type { RequestEvent } from '@sveltejs/kit'
import type { Actions } from './$types'
import {
  createMockLocals,
  createMockFormData,
  createMockCookies,
} from '$lib/test-utils/factories'
import type { Product } from '$lib/types'

// Define proper return types for actions
// Note: Database returns snake_case, not camelCase
type DbProduct = Product & { store_id: string }

type ActionResult =
  | { success: true; product: DbProduct }
  | { success: false; error: string }

type SaleResult =
  | { success: true; sale: { id: string; total: number; store_id: string } }
  | { success: false; error: string }

type DeleteResult = { success: true } | { success: false; error: string }

// Type guard functions
function isSuccessResult(
  result: ActionResult | DeleteResult | SaleResult,
): result is { success: true; product: Product } {
  return (
    result.success === true &&
    'product' in result &&
    result.product !== undefined
  )
}

function isErrorResult(
  result: ActionResult | DeleteResult | SaleResult,
): result is { success: false; error: string } {
  return result.success === false && 'error' in result
}

function isSaleSuccess(
  result: SaleResult | ActionResult | DeleteResult,
): result is { success: true; sale: { id: string; total: number } } {
  return result.success === true && 'sale' in result
}

function isDeleteSuccess(
  result: DeleteResult | ActionResult | SaleResult,
): result is { success: true } {
  return (
    result.success === true && !('product' in result) && !('sale' in result)
  )
}

// Mock redirect
vi.mock('@sveltejs/kit', async () => {
  const actual =
    await vi.importActual<typeof import('@sveltejs/kit')>('@sveltejs/kit')
  return {
    ...actual,
    redirect: vi.fn((status: number, location: string) => {
      throw { status, location }
    }),
  }
})

// Helper to create mock request event
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequestEvent(formData: FormData, localsOverride?: any): any {
  const locals = (localsOverride ?? createMockLocals()) as unknown as App.Locals
  return {
    request: {
      formData: () => Promise.resolve(formData),
    } as unknown as Request,
    locals,
    cookies: createMockCookies() as unknown as RequestEvent['cookies'],
    params: {},
    url: new URL('http://localhost:3000'),
    isDataRequest: false,
  }
}

describe('actions', () => {
  let locals: App.Locals
  let cookies: RequestEvent['cookies']

  beforeEach(() => {
    locals = createMockLocals() as unknown as App.Locals
    cookies = createMockCookies() as unknown as RequestEvent['cookies']
    vi.clearAllMocks()
  })

  describe('createProduct', () => {
    it('should create product with valid data', async () => {
      const formData = createMockFormData({
        name: 'Test Product',
        price: '100',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions['createProduct']>[0],
      )) as ActionResult

      expect(isSuccessResult(result)).toBe(true)
      if (isSuccessResult(result)) {
        expect(result.product).toBeDefined()
        expect(result.product.name).toBe('Test Product')
        expect(result.product.store_id).toBe('store-1')
      }
    })

    it('should return error for missing name', async () => {
      const formData = createMockFormData({
        price: '100',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions['createProduct']>[0],
      )) as ActionResult

      expect(isErrorResult(result)).toBe(true)
      if (isErrorResult(result)) {
        expect(result.error).toBe('Invalid product data')
      }
    })

    it('should return error for invalid price', async () => {
      const formData = createMockFormData({
        name: 'Test',
        price: 'invalid',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions['createProduct']>[0],
      )) as ActionResult

      expect(isErrorResult(result)).toBe(true)
      if (isErrorResult(result)) {
        expect(result.error).toBe('Invalid product data')
      }
    })

    it('should return error when user not authenticated', async () => {
      locals.user = null
      const formData = createMockFormData({
        name: 'Test',
        price: '100',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.createProduct(
        event as unknown as Parameters<Actions['createProduct']>[0],
      )) as ActionResult

      expect(isErrorResult(result)).toBe(true)
      if (isErrorResult(result)) {
        expect(result.error).toBe('User not authenticated')
      }
    })
  })

  describe('updateProduct', () => {
    it('should update product with valid data', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(locals.supabase as any)._mockData.products.push({
        id: 'product-1',
        name: 'Original Name',
        price: 100,
        stock: 10,
        unit: 'und',
        store_id: 'store-1',
      })

      const formData = createMockFormData({
        id: 'product-1',
        name: 'Updated Name',
        price: '150',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.updateProduct(
        event as unknown as Parameters<Actions['updateProduct']>[0],
      )) as ActionResult

      expect(isSuccessResult(result)).toBe(true)
    })

    it('should return error for missing id', async () => {
      const formData = createMockFormData({
        name: 'Test',
        price: '100',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.updateProduct(
        event as unknown as Parameters<Actions['updateProduct']>[0],
      )) as ActionResult

      expect(isErrorResult(result)).toBe(true)
      if (isErrorResult(result)) {
        expect(result.error).toBe('Invalid product data')
      }
    })
  })

  describe('deleteProduct', () => {
    it('should soft delete product', async () => {
      const formData = createMockFormData({ id: 'product-1' })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.deleteProduct(
        event as unknown as Parameters<Actions['deleteProduct']>[0],
      )) as DeleteResult

      expect(isDeleteSuccess(result)).toBe(true)
    })

    it('should return error for missing id', async () => {
      const formData = createMockFormData({})

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.deleteProduct(
        event as unknown as Parameters<Actions['deleteProduct']>[0],
      )) as DeleteResult

      expect(isErrorResult(result)).toBe(true)
      if (isErrorResult(result)) {
        expect(result.error).toBe('Product ID is required')
      }
    })
  })

  describe('processSale', () => {
    it('should process sale with valid data', async () => {
      const items = [
        {
          product: { id: 'prod-1', price: 100, stock: 10 },
          quantity: 2,
        },
      ]
      const formData = createMockFormData({
        paymentMethod: 'cash',
        items: JSON.stringify(items),
        total: '200',
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockSupabase = locals.supabase as any
      mockSupabase._mockData.products.push({
        id: 'prod-1',
        stock: 10,
        name: 'Test Product',
        price: 100,
        store_id: 'store-1',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions['processSale']>[0],
      )) as SaleResult

      expect(isSaleSuccess(result)).toBe(true)
      if (isSaleSuccess(result)) {
        expect(result.sale).toBeDefined()
        expect(result.sale.total).toBe(200)
      }
    })

    it('should return error for invalid items', async () => {
      const formData = createMockFormData({
        total: '100',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions['processSale']>[0],
      )) as SaleResult

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid sale data')
      }
    })

    it('should return error when user not authenticated', async () => {
      locals.user = null
      const formData = createMockFormData({
        paymentMethod: 'cash',
        items: JSON.stringify([]),
        total: '0',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = (await actions.processSale(
        event as unknown as Parameters<Actions['processSale']>[0],
      )) as SaleResult

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('User not authenticated')
      }
    })
  })

  describe('createStockIn', () => {
    it('should create stock in with valid data', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.supabase.from = vi.fn((table: string): any => {
        if (table === 'stock_movements') {
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          }
        }
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { stock: 10 },
                    error: null,
                  }),
                ),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { store_id: 'store-1' },
                  error: null,
                }),
              ),
            })),
          })),
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(locals.supabase as any).rpc = vi.fn(async () => ({
        data: { success: true, stock: 15 },
        error: null,
      }))

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        unitCost: '10.50',
        reason: 'Compra fornecedor',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: true })
    })

    it('should return error for missing productId', async () => {
      const formData = createMockFormData({
        quantity: '5',
        unitCost: '10.50',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for invalid quantity', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '-1',
        unitCost: '10.50',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for zero quantity', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '0',
        unitCost: '10.50',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for invalid unitCost', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        unitCost: 'invalid',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for negative unitCost', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        unitCost: '-1',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error when user not authenticated', async () => {
      locals.user = null

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        unitCost: '10.50',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({
        success: false,
        error: 'User not authenticated',
      })
    })

    it('should return error when user has no store membership', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.supabase.from = vi.fn((table: string): any => {
        if (table === 'store_memberships') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({ data: null, error: null }),
                ),
              })),
            })),
          }
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        }
      })

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        unitCost: '10.50',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockIn(
        event as unknown as Parameters<Actions['createStockIn']>[0],
      )

      expect(result).toEqual({
        success: false,
        error: 'User is not a member of any store',
      })
    })
  })

  describe('createStockOut', () => {
    it('should create stock out with valid data', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.supabase.from = vi.fn((table: string): any => {
        if (table === 'stock_movements') {
          return {
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
            delete: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ error: null })),
            })),
          }
        }
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { stock: 20 },
                    error: null,
                  }),
                ),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { store_id: 'store-1' },
                  error: null,
                }),
              ),
            })),
          })),
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(locals.supabase as any).rpc = vi.fn(async () => ({
        data: { success: true, stock: 15 },
        error: null,
      }))

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
        reason: 'Avaria',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({ success: true })
    })

    it('should return error for missing productId', async () => {
      const formData = createMockFormData({
        quantity: '5',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for invalid quantity', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '-1',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for zero quantity', async () => {
      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '0',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Dados inválidos' })
    })

    it('should return error for insufficient stock', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.supabase.from = vi.fn((table: string): any => {
        if (table === 'products') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { stock: 2 },
                    error: null,
                  }),
                ),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { store_id: 'store-1' },
                  error: null,
                }),
              ),
            })),
          })),
        }
      })

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({ success: false, error: 'Estoque insuficiente' })
    })

    it('should return error when user not authenticated', async () => {
      locals.user = null

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({
        success: false,
        error: 'User not authenticated',
      })
    })

    it('should return error when user has no store membership', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      locals.supabase.from = vi.fn((table: string): any => {
        if (table === 'store_memberships') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({ data: null, error: null }),
                ),
              })),
            })),
          }
        }
        return {
          insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
        }
      })

      const formData = createMockFormData({
        productId: 'prod-1',
        quantity: '5',
      })

      const event = createMockRequestEvent(formData, locals)
      const result = await actions.createStockOut(
        event as unknown as Parameters<Actions['createStockOut']>[0],
      )

      expect(result).toEqual({
        success: false,
        error: 'User is not a member of any store',
      })
    })
  })

  describe('logout', () => {
    it('should sign out user and redirect', async () => {
      const event = {
        locals,
        cookies,
      } as unknown as Parameters<Actions['logout']>[0]

      try {
        await actions.logout(event)
        expect.fail('Should have thrown redirect')
      } catch (error: unknown) {
        const redirectError = error as { status: number; location: string }
        expect(redirectError.status).toBe(303)
        expect(redirectError.location).toBe('/login')
      }
    })

    it('should return error on sign out failure', async () => {
      locals.supabase.auth.signOut = vi
        .fn()
        .mockResolvedValue({ error: { message: 'Sign out failed' } })

      const event = {
        locals,
        cookies,
      } as unknown as Parameters<Actions['logout']>[0]

      const result = await actions.logout(event)

      expect(result).toEqual({
        success: false,
        error: 'Sign out failed',
      })
    })
  })
})
