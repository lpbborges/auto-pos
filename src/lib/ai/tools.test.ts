import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getToolDefinitions, executeToolCall } from './tools'
import { createMockSupabaseClient } from '$lib/test-utils/factories'

describe('getToolDefinitions', () => {
  it('returns an array of 4 tools', () => {
    const tools = getToolDefinitions()
    expect(tools).toHaveLength(4)
  })

  it('includes get_products tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_products')).toBe(true)
  })

  it('includes get_low_stock_items tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_low_stock_items')).toBe(true)
  })

  it('includes get_recent_sales tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_recent_sales')).toBe(true)
  })

  it('includes get_stock_movements tool', () => {
    const tools = getToolDefinitions()
    expect(tools.some((t) => t.name === 'get_stock_movements')).toBe(true)
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
})
