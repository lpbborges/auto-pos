/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Product, CartItem, Sale } from '$lib/types'
import { vi } from 'vitest'

export function createProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: crypto.randomUUID(),
    name: 'Test Product',
    price: 100,
    stock: 10,
    unit: 'und',
    storeId: 'store-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  }
}

export function createCartItem(overrides: Partial<CartItem> = {}): CartItem {
  const product = createProduct(overrides.product)
  return {
    product,
    quantity: 1,
    ...overrides,
  }
}

export function createSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: crypto.randomUUID(),
    paymentMethod: overrides.paymentMethod ?? 'cash',
    items: [],
    total: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export type MockSupabaseClient = any

export function createMockSupabaseClient(): MockSupabaseClient {
  const mockData: Record<string, any[]> = {
    products: [],
    sales: [],
    sale_items: [],
    stores: [],
    store_memberships: [{ store_id: 'store-1', user_id: 'user-1' }],
  }

  const createQueryBuilder = (table: string) => {
    const currentData = [...(mockData[table] || [])]
    const filters: Array<(record: Record<string, any>) => boolean> = []

    const applyFilters = () => {
      return currentData.filter((record) =>
        filters.every((filter) => filter(record)),
      )
    }

    const builder = {
      // select() returns the builder for chaining
      select: vi.fn(() => {
        return builder
      }),

      // eq() adds filter and returns builder
      eq: vi.fn((column: string, value: any) => {
        filters.push((record) => record[column] === value)
        return builder
      }),

      // in() adds filter for values in array
      in: vi.fn((column: string, values: any[]) => {
        filters.push((record) => values.includes(record[column]))
        return builder
      }),

      // is() adds null check filter
      is: vi.fn((column: string, value: any) => {
        filters.push((record) =>
          value === null ? record[column] === null : record[column] === value,
        )
        return builder
      }),

      // order() returns builder
      order: vi.fn((column: string, { ascending = true } = {}) => {
        currentData.sort((a, b) => {
          if (ascending) return a[column] > b[column] ? 1 : -1
          return a[column] < b[column] ? 1 : -1
        })
        return builder
      }),

      // gte() adds filter
      gte: vi.fn((column: string, value: any) => {
        filters.push((record) => record[column] >= value)
        return builder
      }),

      // lte() adds filter
      lte: vi.fn((column: string, value: any) => {
        filters.push((record) => record[column] <= value)
        return builder
      }),

      // limit() limits results
      limit: vi.fn((n: number) => {
        currentData.splice(n)
        return builder
      }),

      // single() executes query and returns single result
      single: vi.fn(() => {
        const filtered = applyFilters()
        const record = filtered[0] || null
        return Promise.resolve({
          data: record,
          error: record ? null : { message: 'Not found' },
        })
      }),

      // insert() creates new records
      insert: vi.fn((records: any | any[]) => {
        const recordsArray = Array.isArray(records) ? records : [records]
        const newRecords = recordsArray.map((r) => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
        }))
        mockData[table] = [...(mockData[table] || []), ...newRecords]

        // Return builder that supports .select().single()
        return {
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: newRecords[0],
                error: null,
              }),
            ),
          })),
          data: newRecords,
          error: null,
        }
      }),

      // update() updates records
      update: vi.fn((updates: any) => ({
        eq: vi.fn((column: string, value: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(() => {
              const index = mockData[table]?.findIndex(
                (r) => r[column] === value,
              )
              if (index > -1) {
                mockData[table][index] = {
                  ...mockData[table][index],
                  ...updates,
                }
                return Promise.resolve({
                  data: mockData[table][index],
                  error: null,
                })
              }
              return Promise.resolve({ data: null, error: null })
            }),
          })),
        })),
      })),

      // delete() removes records
      delete: vi.fn(() => ({
        eq: vi.fn((column: string, value: any) => {
          mockData[table] =
            mockData[table]?.filter((r) => r[column] !== value) || []
          return Promise.resolve({ error: null })
        }),
      })),

      // data and error for direct access
      get data() {
        return applyFilters()
      },
      error: null,
    }

    return builder
  }

  const mockClient = {
    from: vi.fn((table: string) => createQueryBuilder(table)),
    rpc: vi.fn(async (fnName: string, params: Record<string, any>) => {
      if (fnName === 'adjust_product_stock') {
        const product = mockData.products?.find(
          (p) => p.id === params.p_product_id,
        )
        if (!product) {
          return {
            data: { success: false, error: 'Product not found' },
            error: null,
          }
        }
        const newStock = Number(product.stock) + Number(params.p_delta)
        if (newStock < 0) {
          return {
            data: { success: false, error: 'Insufficient stock' },
            error: null,
          }
        }
        product.stock = newStock
        product.updated_at = params.p_updated_at
        return { data: { success: true, stock: newStock }, error: null }
      }
      return {
        data: null,
        error: { message: `Unknown RPC function: ${fnName}` },
      }
    }),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: {
            session: {
              user: { id: 'user-1', email: 'test@example.com' },
            },
          },
          error: null,
        }),
      ),
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: { id: 'user-1', email: 'test@example.com' } },
          error: null,
        }),
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    _mockData: mockData,
  }

  return mockClient as MockSupabaseClient
}

export function createMockLocals() {
  const mockSession = {
    user: { id: 'user-1', email: 'test@example.com' },
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    expires_at: Date.now() + 3600,
    expires_in: 3600,
    token_type: 'bearer' as const,
  }

  return {
    user: { id: 'user-1', email: 'test@example.com' },
    session: mockSession,
    supabase: createMockSupabaseClient(),
    safeGetSession: vi.fn(() =>
      Promise.resolve({
        session: mockSession,
        user: { id: 'user-1', email: 'test@example.com' },
      }),
    ),
  }
}

export function createMockFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

export function createMockCookies() {
  const cookies: Record<string, string> = {}
  return {
    get: vi.fn((name: string) => cookies[name] || undefined),
    getAll: vi.fn(() =>
      Object.entries(cookies).map(([name, value]) => ({ name, value })),
    ),
    set: vi.fn((name: string, value: string) => {
      cookies[name] = value
    }),
    delete: vi.fn((name: string) => {
      delete cookies[name]
    }),
    serialize: vi.fn((name: string, value: string) => {
      return `${name}=${value}`
    }),
  }
}
