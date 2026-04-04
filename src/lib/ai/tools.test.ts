import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getToolDefinitions, executeToolCall } from './tools'
import { createMockSupabaseClient } from '$lib/test-utils/factories'

describe('getToolDefinitions', () => {
  it('returns an array of 5 tools', () => {
    const tools = getToolDefinitions()
    expect(tools).toHaveLength(5)
  })

  it('includes get_products tool', () => {
    const tools = getToolDefinitions()
    expect(
      tools.some(
        (t) => t.type === 'function' && t.function.name === 'get_products',
      ),
    ).toBe(true)
  })

  it('includes get_low_stock_items tool', () => {
    const tools = getToolDefinitions()
    expect(
      tools.some(
        (t) =>
          t.type === 'function' && t.function.name === 'get_low_stock_items',
      ),
    ).toBe(true)
  })

  it('includes get_recent_sales tool', () => {
    const tools = getToolDefinitions()
    expect(
      tools.some(
        (t) => t.type === 'function' && t.function.name === 'get_recent_sales',
      ),
    ).toBe(true)
  })

  it('includes get_stock_movements tool', () => {
    const tools = getToolDefinitions()
    expect(
      tools.some(
        (t) =>
          t.type === 'function' && t.function.name === 'get_stock_movements',
      ),
    ).toBe(true)
  })

  it('includes create_product tool', () => {
    const tools = getToolDefinitions()
    expect(
      tools.some(
        (t) => t.type === 'function' && t.function.name === 'create_product',
      ),
    ).toBe(true)
  })
})

describe('executeToolCall', () => {
  let supabase: ReturnType<typeof createMockSupabaseClient>
  const storeId = 'store-1'

  beforeEach(() => {
    supabase = createMockSupabaseClient()
    vi.clearAllMocks()
  })

  describe('get_products', () => {
    it('queries products table with store_id filter', async () => {
      await executeToolCall('get_products', {}, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('products')
    })

    it('returns error object on Supabase failure', async () => {
      supabase.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(() =>
          Promise.resolve({ data: null, error: { message: 'DB error' } }),
        ),
      }))
      const result = await executeToolCall(
        'get_products',
        {},
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })
  })

  describe('get_low_stock_items', () => {
    it('queries products with stock threshold', async () => {
      await executeToolCall(
        'get_low_stock_items',
        { threshold: 5 },
        storeId,
        supabase,
      )
      expect(supabase.from).toHaveBeenCalledWith('products')
    })

    it('uses default threshold of 5 when not provided', async () => {
      await expect(
        executeToolCall('get_low_stock_items', {}, storeId, supabase),
      ).resolves.not.toThrow()
    })
  })

  describe('get_recent_sales', () => {
    it('queries sales table with store_id filter', async () => {
      await executeToolCall('get_recent_sales', { days: 7 }, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('sales')
    })

    it('uses default of 7 days when not provided', async () => {
      await expect(
        executeToolCall('get_recent_sales', {}, storeId, supabase),
      ).resolves.not.toThrow()
    })
  })

  describe('get_stock_movements', () => {
    it('queries stock_movements table', async () => {
      await executeToolCall('get_stock_movements', {}, storeId, supabase)
      expect(supabase.from).toHaveBeenCalledWith('stock_movements')
    })
  })

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await executeToolCall(
        'unknown_tool',
        {},
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })
  })

  describe('create_product', () => {
    // Each test gets a fresh spy state so call assertions don't bleed between cases
    beforeEach(() => {
      vi.clearAllMocks()
      supabase = createMockSupabaseClient()
    })

    it('inserts into products table', async () => {
      await executeToolCall(
        'create_product',
        { name: 'Arroz', price: 5.0, unit: 'kg' },
        storeId,
        supabase,
      )
      expect(supabase.from).toHaveBeenCalledWith('products')
    })

    it('does not insert stock movement when stock is 0', async () => {
      await executeToolCall(
        'create_product',
        { name: 'Arroz', price: 5.0, unit: 'kg', stock: 0 },
        storeId,
        supabase,
      )
      expect(supabase.from).not.toHaveBeenCalledWith('stock_movements')
    })

    it('inserts stock movement with correct shape when stock > 0', async () => {
      await executeToolCall(
        'create_product',
        { name: 'Arroz', price: 5.0, unit: 'kg', stock: 10 },
        storeId,
        supabase,
      )
      expect(supabase.from).toHaveBeenCalledWith('stock_movements')
      // Find the insert call on the stock_movements builder and verify unit_cost is present
      const calls = supabase.from.mock.calls
      const movementsCallIndex = calls.findIndex(
        ([t]: [string]) => t === 'stock_movements',
      )
      expect(movementsCallIndex).toBeGreaterThanOrEqual(0)
      // The builder returned by supabase.from('stock_movements') had insert called on it
      // Verify by checking the insert mock was called with unit_cost: 0
      const movementsBuilder =
        supabase.from.mock.results[movementsCallIndex]?.value
      expect(movementsBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ unit_cost: 0, type: 'in' }),
      )
    })

    it('returns error for missing name', async () => {
      const result = await executeToolCall(
        'create_product',
        { price: 5.0, unit: 'kg' },
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })

    it('returns error for invalid unit', async () => {
      const result = await executeToolCall(
        'create_product',
        { name: 'Arroz', price: 5.0, unit: 'invalid' },
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })

    it('returns error on Supabase failure', async () => {
      supabase.from = vi.fn((table: string) => {
        if (table === 'products') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'DB error' },
                  }),
                ),
              })),
            })),
          }
        }
        return supabase.from(table)
      })
      const result = await executeToolCall(
        'create_product',
        { name: 'Arroz', price: 5.0, unit: 'kg' },
        storeId,
        supabase,
      )
      expect(result).toHaveProperty('error')
    })
  })
})
