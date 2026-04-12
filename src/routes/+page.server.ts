import { redirect } from '@sveltejs/kit'
import { v7 as generateUUIDv7 } from 'uuid'
import type { Actions, PageServerLoad } from './$types'
import { PRODUCT_UNITS } from '$lib/constants'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user

  const { data: products, error: productsError } = await locals.supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
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
    const formData = await request.formData()
    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const unit = (formData.get('unit') as string) || 'und'
    const stock = parseFloat(formData.get('stock') as string) || 0
    const unitCostRaw = formData.get('unitCost') as string | null
    const unitCost = unitCostRaw !== null ? parseFloat(unitCostRaw) : 0

    if (
      !name ||
      name.trim().length === 0 ||
      name.length > 255 ||
      isNaN(price)
    ) {
      return { success: false, error: 'Invalid product data' }
    }

    if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
      return { success: false, error: 'Invalid unit' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
    }

    const { data, error } = await locals.supabase
      .from('products')
      .insert([{ name, price, stock, unit, store_id: locals.storeId }])
      .select()
      .single()

    if (error) {
      console.error('Error creating product:', error)
      return { success: false, error: error.message }
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
        await locals.supabase.from('products').delete().eq('id', data.id)
        return { success: false, error: movementError.message }
      }
    }

    return { success: true, product: data }
  },

  updateProduct: async ({ request, locals }) => {
    const formData = await request.formData()
    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const price = parseFloat(formData.get('price') as string)
    const unit = (formData.get('unit') as string) || 'und'

    if (
      !id ||
      !name ||
      name.trim().length === 0 ||
      name.length > 255 ||
      isNaN(price)
    ) {
      return { success: false, error: 'Invalid product data' }
    }

    if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
      return { success: false, error: 'Invalid unit' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
    }

    // Verify product belongs to this store before updating
    const { data: existingProduct } = await locals.supabase
      .from('products')
      .select('store_id')
      .eq('id', id)
      .single()

    if (!existingProduct || existingProduct.store_id !== locals.storeId) {
      return { success: false, error: 'Product not found' }
    }

    // Now update product details (name, price, unit)
    const { data, error } = await locals.supabase
      .from('products')
      .update({ name, price, unit, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', locals.storeId)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return { success: false, error: error.message }
    }

    return { success: true, product: data }
  },

  deleteProduct: async ({ request, locals }) => {
    const formData = await request.formData()
    const id = formData.get('id') as string

    if (!id) {
      return { success: false, error: 'Product ID is required' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
    }

    // Verify product belongs to this store before deleting
    const { data: existingProduct } = await locals.supabase
      .from('products')
      .select('store_id')
      .eq('id', id)
      .single()

    if (!existingProduct || existingProduct.store_id !== locals.storeId) {
      return { success: false, error: 'Product not found' }
    }

    const { error } = await locals.supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('store_id', locals.storeId)

    if (error) {
      console.error('Error deleting product:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  },

  createStockIn: async ({ request, locals }) => {
    const formData = await request.formData()
    const productId = formData.get('productId') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const unitCost = parseFloat(formData.get('unitCost') as string)
    const reason = (formData.get('reason') as string) || 'Entrada manual'

    if (reason.length > 500) {
      return { success: false, error: 'Reason too long' }
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

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
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
      return { success: false, error: movementError.message }
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
      await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      return { success: false, error: stockError.message }
    }

    if (!adjustResult?.success) {
      await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      return {
        success: false,
        error: adjustResult?.error || 'Failed to update stock',
      }
    }

    return { success: true }
  },

  createStockOut: async ({ request, locals }) => {
    const formData = await request.formData()
    const productId = formData.get('productId') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const reason = (formData.get('reason') as string) || 'Saída manual'

    if (reason.length > 500) {
      return { success: false, error: 'Reason too long' }
    }

    if (!productId || isNaN(quantity) || quantity <= 0) {
      return { success: false, error: 'Dados inválidos' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
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
      return { success: false, error: movementError.message }
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
      await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      return { success: false, error: stockError.message }
    }

    if (!adjustResult?.success) {
      await locals.supabase
        .from('stock_movements')
        .delete()
        .eq('id', movementId)
      return {
        success: false,
        error: adjustResult?.error || 'Failed to update stock',
      }
    }

    return { success: true }
  },

  processSale: async ({ request, locals }) => {
    const formData = await request.formData()
    const itemsJson = formData.get('items') as string
    const total = parseFloat(formData.get('total') as string)
    const paymentMethod = formData.get('paymentMethod') as string

    if (!itemsJson || isNaN(total)) {
      return { success: false, error: 'Invalid sale data' }
    }

    const validPaymentMethods = ['cash', 'pix', 'debit_card', 'credit_card']
    if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
      return { success: false, error: 'Selecione uma forma de pagamento' }
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
      return { success: false, error: 'Invalid sale data' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    if (!locals.storeId) {
      return { success: false, error: 'User is not a member of any store' }
    }

    // Check stock availability for all items before processing
    const productIds = items.map((item) => item.product.id)

    const { data: products, error: productsError } = await locals.supabase
      .from('products')
      .select('id, stock')
      .in('id', productIds)
      .eq('store_id', locals.storeId)

    if (productsError) {
      console.error('Error checking products:', productsError)
      return { success: false, error: 'Erro ao verificar produtos' }
    }

    const stockMap: Record<string, number> = {}
    if (products) {
      for (const p of products) {
        stockMap[p.id] = p.stock
      }
    }

    for (const item of items) {
      const productId = item.product.id
      const quantity = item.quantity
      const currentStock = stockMap[productId]

      if (currentStock === undefined) {
        return { success: false, error: `Produto não encontrado` }
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

    const { data: sale, error: saleError } = await locals.supabase
      .from('sales')
      .insert([
        { total, store_id: locals.storeId, payment_method: paymentMethod },
      ])
      .select()
      .single()

    if (saleError) {
      console.error('Error creating sale:', saleError)
      return { success: false, error: saleError.message }
    }

    const saleItems = items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product.id,
      quantity: item.quantity,
      price_at_sale: item.product.price,
      cost_at_sale: avgCostMap[item.product.id] ?? 0,
      store_id: locals.storeId,
    }))

    const { error: itemsError } = await locals.supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      console.error('Error creating sale items:', itemsError)
      await locals.supabase.from('sales').delete().eq('id', sale.id)
      return { success: false, error: itemsError.message }
    }

    const createdMovementIds: string[] = []

    for (const item of items) {
      const movementId = generateUUIDv7()

      const { error: movementError } = await locals.supabase
        .from('stock_movements')
        .insert({
          id: movementId,
          product_id: item.product.id,
          store_id: locals.storeId,
          type: 'out',
          quantity: item.quantity,
          reason: 'Venda',
          sale_id: sale.id,
        })

      if (movementError) {
        console.error('Error creating stock movement:', movementError)
        for (const id of createdMovementIds) {
          await locals.supabase.from('stock_movements').delete().eq('id', id)
        }
        await locals.supabase.from('sale_items').delete().eq('sale_id', sale.id)
        await locals.supabase.from('sales').delete().eq('id', sale.id)
        return { success: false, error: movementError.message }
      }

      createdMovementIds.push(movementId)

      const { data: adjustResult, error: stockError } =
        await locals.supabase.rpc('adjust_product_stock', {
          p_product_id: item.product.id,
          p_delta: -item.quantity,
          p_updated_at: new Date().toISOString(),
        })

      if (stockError) {
        console.error('Error updating stock:', stockError)
        for (const id of createdMovementIds) {
          await locals.supabase.from('stock_movements').delete().eq('id', id)
        }
        await locals.supabase.from('sale_items').delete().eq('sale_id', sale.id)
        await locals.supabase.from('sales').delete().eq('id', sale.id)
        return { success: false, error: stockError.message }
      }

      if (!adjustResult?.success) {
        for (const id of createdMovementIds) {
          await locals.supabase.from('stock_movements').delete().eq('id', id)
        }
        await locals.supabase.from('sale_items').delete().eq('sale_id', sale.id)
        await locals.supabase.from('sales').delete().eq('id', sale.id)
        return {
          success: false,
          error: adjustResult?.error || 'Failed to update stock',
        }
      }
    }

    return { success: true, sale }
  },

  logout: async ({ locals }) => {
    const { error } = await locals.supabase.auth.signOut()

    if (error) {
      console.error('Error signing out:', error)
      return { success: false, error: error.message }
    }

    throw redirect(303, '/login')
  },
}
