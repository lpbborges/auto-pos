import { redirect } from '@sveltejs/kit'
import { v7 as generateUUIDv7 } from 'uuid'
import type { Actions, PageServerLoad } from './$types'
import { VALID_PAYMENT_METHODS } from '$lib/types'
import { validateProductData } from '$lib/utils'

function requireAuth(
  locals: App.Locals,
): { success: false; error: string } | null {
  if (!locals.user) {
    return { success: false, error: 'Usuário não autenticado' }
  }
  if (!locals.storeId) {
    return { success: false, error: 'Usuário não pertence a uma loja' }
  }
  return null
}

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user

  const { data: products, error: productsError } = await locals.supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .eq('store_id', locals.storeId)
    .order('created_at', { ascending: false })

  if (productsError) {
    console.error('Error loading products:', productsError)
  }

  let store = null
  if (user && locals.storeId) {
    const { data: storeData } = await locals.supabase
      .from('stores')
      .select('id, name')
      .eq('id', locals.storeId)
      .single()

    if (storeData) {
      store = { id: storeData.id, name: storeData.name }
    }
  }

  return {
    products: products ?? [],
    user: user?.email ? { email: user.email, id: user.id } : null,
    store,
  }
}

export const actions: Actions = {
  createProduct: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const unit = (formData.get('unit') as string) || 'und'
    const stock = parseFloat(formData.get('stock') as string) || 0
    const unitCostRaw = formData.get('unitCost') as string | null
    const unitCost = unitCostRaw !== null ? parseFloat(unitCostRaw) : 0

    const validationError = validateProductData(name, price, unit)
    if (validationError) {
      return { success: false, error: validationError }
    }

    const { data, error } = await locals.supabase
      .from('products')
      .insert([{ name, price, stock, unit, store_id: locals.storeId }])
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return { success: false, error: 'Erro ao criar produto' }
    }

    if (stock > 0) {
      const { error: movementError } = await locals.supabase
        .from('stock_movements')
        .insert([
          {
            id: generateUUIDv7(),
            product_id: data.id,
            store_id: locals.storeId,
            type: 'in',
            quantity: stock,
            unit_cost: isNaN(unitCost) || unitCost < 0 ? 0 : unitCost,
            reason: 'Estoque inicial',
          },
        ])

      if (movementError) {
        console.error('Error creating stock movement:', movementError)
        const { error: cleanupError } = await locals.supabase
          .from('products')
          .delete()
          .eq('id', data.id)
        if (cleanupError)
          console.error('Error cleaning up orphaned product:', cleanupError)
        return { success: false, error: 'Erro ao criar movimento de estoque' }
      }
    }

    return { success: true, product: data }
  },

  updateProduct: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const unit = (formData.get('unit') as string) || 'und'

    const validationError = validateProductData(name, price, unit)
    if (!id || validationError) {
      return {
        success: false,
        error: validationError || 'ID do produto inválido',
      }
    }

    // Verify product belongs to this store before updating
    const { data: existingProduct } = await locals.supabase
      .from('products')
      .select('store_id')
      .eq('id', id)
      .single()

    if (!existingProduct || existingProduct.store_id !== locals.storeId) {
      return { success: false, error: 'Produto não encontrado' }
    }

    const { data, error } = await locals.supabase
      .from('products')
      .update({ name, price, unit, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', locals.storeId)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return { success: false, error: 'Erro ao atualizar produto' }
    }

    return { success: true, product: data }
  },

  deleteProduct: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const id = formData.get('id') as string

    if (!id) {
      return { success: false, error: 'ID do produto não informado' }
    }

    // Verify product belongs to this store before deleting
    const { data: existingProduct } = await locals.supabase
      .from('products')
      .select('store_id')
      .eq('id', id)
      .single()

    if (!existingProduct || existingProduct.store_id !== locals.storeId) {
      return { success: false, error: 'Produto não encontrado' }
    }

    const { error } = await locals.supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', locals.storeId)

    if (error) {
      console.error('Error deleting product:', error)
      return { success: false, error: 'Erro ao excluir produto' }
    }

    return { success: true }
  },

  createStockIn: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const productId = formData.get('productId') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const unitCost = parseFloat(formData.get('unitCost') as string)
    const reason = (formData.get('reason') as string) || 'Entrada manual'

    if (reason.length > 500) {
      return { success: false, error: 'Motivo muito longo' }
    }

    if (
      !productId ||
      isNaN(quantity) ||
      quantity <= 0 ||
      isNaN(unitCost) ||
      unitCost < 0
    ) {
      return { success: false, error: 'Dados inválidos' }
    }

    const { data: product } = await locals.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('store_id', locals.storeId)
      .single()

    if (!product) {
      return { success: false, error: 'Produto não encontrado' }
    }

    const movementId = generateUUIDv7()

    const { error: movementError } = await locals.supabase
      .from('stock_movements')
      .insert({
        id: movementId,
        product_id: productId,
        store_id: locals.storeId,
        type: 'in',
        quantity,
        unit_cost: unitCost,
        reason,
      })

    if (movementError) {
      console.error('Error creating stock in:', movementError)
      return { success: false, error: 'Erro ao criar entrada de estoque' }
    }

    const { data: adjustResult, error: stockError } = await locals.supabase.rpc(
      'adjust_product_stock',
      {
        p_product_id: productId,
        p_delta: quantity,
        p_updated_at: new Date().toISOString(),
      },
    )

    if (stockError) {
      console.error('Error updating stock:', stockError)
      const { error: cleanupError } = await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      if (cleanupError)
        console.error('Error cleaning up orphaned movement:', cleanupError)
      return { success: false, error: 'Erro ao atualizar estoque' }
    }

    if (!adjustResult?.success) {
      const { error: cleanupError } = await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      if (cleanupError)
        console.error('Error cleaning up orphaned movement:', cleanupError)
      return {
        success: false,
        error: adjustResult?.error || 'Erro ao atualizar estoque',
      }
    }

    return { success: true }
  },

  createStockOut: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const productId = formData.get('productId') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const reason = (formData.get('reason') as string) || 'Saída manual'

    if (reason.length > 500) {
      return { success: false, error: 'Motivo muito longo' }
    }

    if (!productId || isNaN(quantity) || quantity <= 0) {
      return { success: false, error: 'Dados inválidos' }
    }

    const { data: product } = await locals.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
      .eq('store_id', locals.storeId)
      .single()

    if (!product || product.stock < quantity) {
      return { success: false, error: 'Estoque insuficiente' }
    }

    const movementId = generateUUIDv7()

    const { error: movementError } = await locals.supabase
      .from('stock_movements')
      .insert({
        id: movementId,
        product_id: productId,
        store_id: locals.storeId,
        type: 'out',
        quantity,
        reason,
      })

    if (movementError) {
      console.error('Error creating stock out:', movementError)
      return { success: false, error: 'Erro ao criar saída de estoque' }
    }

    const { data: adjustResult, error: stockError } = await locals.supabase.rpc(
      'adjust_product_stock',
      {
        p_product_id: productId,
        p_delta: -quantity,
        p_updated_at: new Date().toISOString(),
      },
    )

    if (stockError) {
      console.error('Error updating stock:', stockError)
      const { error: cleanupError } = await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      if (cleanupError)
        console.error('Error cleaning up orphaned movement:', cleanupError)
      return { success: false, error: 'Erro ao atualizar estoque' }
    }

    if (!adjustResult?.success) {
      const { error: cleanupError } = await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      if (cleanupError)
        console.error('Error cleaning up orphaned movement:', cleanupError)
      return {
        success: false,
        error: adjustResult?.error || 'Erro ao atualizar estoque',
      }
    }

    return { success: true }
  },

  processSale: async ({ request, locals }) => {
    const authError = requireAuth(locals)
    if (authError) return authError

    const formData = await request.formData()
    const itemsJson = formData.get('items') as string
    const paymentMethod = formData.get('paymentMethod') as string
    const saleDateRaw = (formData.get('saleDate') as string) || ''

    if (!itemsJson) {
      return { success: false, error: 'Dados da venda inválidos' }
    }

    if (
      !paymentMethod ||
      !VALID_PAYMENT_METHODS.includes(
        paymentMethod as (typeof VALID_PAYMENT_METHODS)[number],
      )
    ) {
      return { success: false, error: 'Selecione uma forma de pagamento' }
    }

    const today = new Date().toISOString().split('T')[0]
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    let soldAt = today
    if (saleDateRaw) {
      if (!datePattern.test(saleDateRaw) || saleDateRaw > today) {
        return { success: false, error: 'Data da venda inválida' }
      }
      soldAt = saleDateRaw
    }

    type SaleItem = {
      product: { id: string; price: number; name: string }
      quantity: number
    }
    let items: SaleItem[]
    try {
      const parsed = JSON.parse(itemsJson)
      if (!Array.isArray(parsed)) throw new Error('items must be an array')
      items = parsed as SaleItem[]
    } catch {
      return { success: false, error: 'Dados da venda inválidos' }
    }

    const productIds = items.map((item) => item.product.id)

    const { data: products, error: productsError } = await locals.supabase
      .from('products')
      .select('id, stock, price')
      .in('id', productIds)
      .eq('store_id', locals.storeId)

    if (productsError) {
      console.error('Error checking products:', productsError)
      return { success: false, error: 'Erro ao verificar produtos' }
    }

    const stockMap: Record<string, number> = {}
    const priceMap: Record<string, number> = {}
    if (products) {
      for (const p of products) {
        stockMap[p.id] = p.stock
        priceMap[p.id] = p.price
      }
    }

    for (const item of items) {
      const productId = item.product.id
      const quantity = item.quantity
      const currentStock = stockMap[productId]

      if (currentStock === undefined) {
        return { success: false, error: 'Produto não encontrado' }
      }

      if (currentStock < quantity) {
        return {
          success: false,
          error: `Estoque insuficiente para ${item.product.name}`,
        }
      }
    }

    const { data: costData } = await locals.supabase.rpc(
      'get_avg_product_costs',
      {
        p_product_ids: productIds,
        p_store_id: locals.storeId,
      },
    )

    const avgCostMap: Record<string, number> = {}
    if (costData) {
      for (const row of costData) {
        avgCostMap[row.product_id] = row.avg_cost ?? 0
      }
    }

    const computedTotal = items.reduce((sum, item) => {
      const price = priceMap[item.product.id] ?? 0
      return sum + price * item.quantity
    }, 0)

    // Atomically claim stock before creating any records
    const updatedAt = new Date().toISOString()
    const adjustResults = await Promise.all(
      items.map((item) =>
        locals.supabase.rpc('adjust_product_stock', {
          p_product_id: item.product.id,
          p_delta: -item.quantity,
          p_updated_at: updatedAt,
        }),
      ),
    )

    const hasFailure = adjustResults.some((r) => r.error || !r.data?.success)
    if (hasFailure) {
      // Reverse any successful adjustments
      await Promise.all(
        adjustResults.map((r, i) =>
          r.data?.success
            ? locals.supabase.rpc('adjust_product_stock', {
                p_product_id: items[i].product.id,
                p_delta: items[i].quantity,
                p_updated_at: updatedAt,
              })
            : Promise.resolve(),
        ),
      )
      return {
        success: false,
        error: 'Estoque insuficiente para completar a venda',
      }
    }

    const { data: sale, error: saleError } = await locals.supabase
      .from('sales')
      .insert([
        {
          total: computedTotal,
          store_id: locals.storeId,
          payment_method: paymentMethod,
          sold_at: soldAt,
        },
      ])
      .select()
      .single()

    if (saleError) {
      console.error('Error creating sale:', saleError)
      await Promise.all(
        items.map((item) =>
          locals.supabase.rpc('adjust_product_stock', {
            p_product_id: item.product.id,
            p_delta: item.quantity,
            p_updated_at: updatedAt,
          }),
        ),
      )
      return { success: false, error: 'Erro ao processar venda' }
    }

    const saleItems = items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_sale: priceMap[item.product.id] ?? 0,
      cost_at_sale: avgCostMap[item.product.id] ?? 0,
      store_id: locals.storeId,
    }))

    const { error: itemsError } = await locals.supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      console.error('Error creating sale items:', itemsError)
      const { error: saleCleanup } = await locals.supabase
        .from('sales')
        .delete()
        .eq('id', sale.id)
      if (saleCleanup) console.error('Error rolling back sale:', saleCleanup)
      await Promise.all(
        items.map((item) =>
          locals.supabase.rpc('adjust_product_stock', {
            p_product_id: item.product.id,
            p_delta: item.quantity,
            p_updated_at: updatedAt,
          }),
        ),
      )
      return { success: false, error: 'Erro ao processar venda' }
    }

    const movementIds = items.map(() => generateUUIDv7())
    const movements = items.map((item, i) => ({
      id: movementIds[i],
      product_id: item.product.id,
      store_id: locals.storeId,
      type: 'out' as const,
      quantity: item.quantity,
      reason: 'Venda',
      sale_id: sale.id,
    }))

    const { error: movementsError } = await locals.supabase
      .from('stock_movements')
      .insert(movements)

    if (movementsError) {
      console.error('Error creating stock movements:', movementsError)
      const { error: itemsCleanup } = await locals.supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', sale.id)
      if (itemsCleanup)
        console.error('Error rolling back sale items:', itemsCleanup)
      const { error: saleCleanup } = await locals.supabase
        .from('sales')
        .delete()
        .eq('id', sale.id)
      if (saleCleanup) console.error('Error rolling back sale:', saleCleanup)
      await Promise.all(
        items.map((item) =>
          locals.supabase.rpc('adjust_product_stock', {
            p_product_id: item.product.id,
            p_delta: item.quantity,
            p_updated_at: updatedAt,
          }),
        ),
      )
      return { success: false, error: 'Erro ao processar venda' }
    }

    return { success: true, sale }
  },

  logout: async ({ locals }) => {
    const { error } = await locals.supabase.auth.signOut()

    if (error) {
      console.error('Error signing out:', error)
      return { success: false, error: 'Erro ao sair' }
    }

    throw redirect(303, '/login')
  },
}
