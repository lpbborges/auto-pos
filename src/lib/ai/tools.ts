import type OpenAI from 'openai'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export function getToolDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_products',
        description:
          'Returns all active products in the store with name, price, stock quantity, and unit. Use when the user asks about their inventory or product list.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_low_stock_items',
        description:
          'Returns products with stock below a threshold. Use when the user asks about low stock, what is running out, or what needs to be restocked.',
        parameters: {
          type: 'object',
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
    },
    {
      type: 'function',
      function: {
        name: 'get_recent_sales',
        description:
          'Returns sales from the past N days with total amount and payment method. Use when the user asks about sales history, revenue, or payment breakdown.',
        parameters: {
          type: 'object',
          properties: {
            days: {
              type: 'number',
              description: 'Number of past days to include. Defaults to 7.',
            },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_stock_movements',
        description:
          'Returns recent stock movement history (entries and exits) with product names. Use when the user asks about stock changes, what came in or out.',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_product',
        description:
          'Creates a new product in the store. Only call this after the user has confirmed the product details. Required: name, price, unit. Optional: initial stock quantity.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Product name.',
            },
            price: {
              type: 'number',
              description: 'Product price in BRL.',
            },
            unit: {
              type: 'string',
              enum: ['kg', 'g', 'lt', 'und'],
              description: 'Unit of measure.',
            },
            stock: {
              type: 'number',
              description: 'Initial stock quantity. Defaults to 0.',
            },
          },
          required: ['name', 'price', 'unit'],
        },
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
          typeof input.threshold === 'number'
            ? Math.min(Math.max(input.threshold, 0), 1000)
            : 5
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
        const days =
          typeof input.days === 'number'
            ? Math.min(Math.max(input.days, 1), 90)
            : 7
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
