import type { Tool } from '@anthropic-ai/sdk/resources'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export function getToolDefinitions(): Tool[] {
  return [
    {
      name: 'get_products',
      description:
        'Returns all active products in the store with name, price, stock quantity, and unit. Use when the user asks about their inventory or product list.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_low_stock_items',
      description:
        'Returns products with stock below a threshold. Use when the user asks about low stock, what is running out, or what needs to be restocked.',
      input_schema: {
        type: 'object' as const,
        properties: {
          threshold: {
            type: 'number',
            description:
              'Stock level below which a product is considered low. Defaults to 5.',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_recent_sales',
      description:
        'Returns sales from the past N days with total amount and payment method. Use when the user asks about sales history, revenue, or payment breakdown.',
      input_schema: {
        type: 'object' as const,
        properties: {
          days: {
            type: 'number',
            description: 'Number of past days to include. Defaults to 7.',
          },
        },
        required: [],
      },
    },
    {
      name: 'get_stock_movements',
      description:
        'Returns recent stock movement history (entries and exits) with product names. Use when the user asks about stock changes, what came in or out.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ]
}

export async function executeToolCall(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
  storeId: string,
  supabase: SupabaseClient,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  try {
    switch (toolName) {
      case 'get_products': {
        const { data, error } = await supabase
          .from('products')
          .select('name, price, stock, unit')
          .is('deleted_at', null)
          .eq('store_id', storeId)
          .order('name')
        if (error) return { error: 'Could not retrieve products' }
        return data
      }

      case 'get_low_stock_items': {
        const threshold =
          typeof input.threshold === 'number' ? input.threshold : 5
        const { data, error } = await supabase
          .from('products')
          .select('name, price, stock, unit')
          .is('deleted_at', null)
          .eq('store_id', storeId)
          .lte('stock', threshold)
          .order('stock')
        if (error) return { error: 'Could not retrieve low stock items' }
        return data
      }

      case 'get_recent_sales': {
        const days = typeof input.days === 'number' ? input.days : 7
        const cutoff = new Date(
          Date.now() - days * 24 * 60 * 60 * 1000,
        ).toISOString()
        const { data, error } = await supabase
          .from('sales')
          .select('id, total, payment_method, created_at')
          .eq('store_id', storeId)
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
        if (error) return { error: 'Could not retrieve recent sales' }
        return data
      }

      case 'get_stock_movements': {
        const { data, error } = await supabase
          .from('stock_movements')
          .select('type, quantity, reason, created_at, product:products(name)')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (error) return { error: 'Could not retrieve stock movements' }
        return data
      }

      default:
        return { error: `Unknown tool: ${toolName}` }
    }
  } catch {
    return { error: 'Tool execution failed' }
  }
}
