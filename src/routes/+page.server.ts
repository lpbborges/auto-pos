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
  if (user) {
    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (membership) {
      const { data: storeData } = await locals.supabase
        .from('stores')
        .select('id, name')
        .eq('id', membership.store_id)
        .single()

      if (storeData) {
        store = { id: storeData.id, name: storeData.name }
      }
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

    if (!name || isNaN(price)) {
      return { success: false, error: 'Invalid product data' }
    }

    if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
      return { success: false, error: 'Invalid unit' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'User is not a member of any store' }
    }

    const { data, error } = await locals.supabase
      .from('products')
      .insert([{ name, price, stock, unit, store_id: membership.store_id }])
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
            store_id: membership.store_id,
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
    const stock = parseFloat(formData.get('stock') as string) || 0
    const previousStock =
      parseFloat(formData.get('previousStock') as string) || 0
    const unitCostRaw = formData.get('unitCost') as string | null
    const unitCost = unitCostRaw !== null ? parseFloat(unitCostRaw) : 0

    if (!id || !name || isNaN(price)) {
      return { success: false, error: 'Invalid product data' }
    }

    if (!PRODUCT_UNITS.includes(unit as (typeof PRODUCT_UNITS)[number])) {
      return { success: false, error: 'Invalid unit' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'User is not a member of any store' }
    }

    const stockDelta = stock - previousStock

    // Update stock first if it changed, so we can rollback atomically
    if (stockDelta !== 0) {
      const movementId = generateUUIDv7()

      // Create stock movement first
      const { error: movementError } = await locals.supabase
        .from('stock_movements')
        .insert([
          {
            id: movementId,
            product_id: id,
            store_id: membership.store_id,
            type: stockDelta > 0 ? 'in' : 'out',
            quantity: Math.abs(stockDelta),
            unit_cost:
              stockDelta > 0
                ? isNaN(unitCost) || unitCost < 0
                  ? 0
                  : unitCost
                : null,
            reason: 'Ajuste manual',
          },
        ])

      if (movementError) {
        console.error('Error creating stock movement:', movementError)
        return { success: false, error: movementError.message }
      }

      // Update stock via RPC
      const { data: adjustResult, error: stockError } =
        await locals.supabase.rpc('adjust_product_stock', {
          p_product_id: id,
          p_delta: stockDelta,
          p_updated_at: new Date().toISOString(),
        })

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
    }

    // Now update product details (name, price, unit)
    const { data, error } = await locals.supabase
      .from('products')
      .update({ name, price, unit, updated_at: new Date().toISOString() })
      .eq('id', id)
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

    const { error } = await locals.supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

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

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'User is not a member of any store' }
    }

    const { data: product } = await locals.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
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
        store_id: membership.store_id,
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

    if (!productId || isNaN(quantity) || quantity <= 0) {
      return { success: false, error: 'Dados inválidos' }
    }

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'User is not a member of any store' }
    }

    const { data: product } = await locals.supabase
      .from('products')
      .select('stock')
      .eq('id', productId)
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
        store_id: membership.store_id,
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

    const items = JSON.parse(itemsJson)

    const user = locals.user
    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return { success: false, error: 'User is not a member of any store' }
    }

    // Check stock availability for all items before processing
    const productIds = items.map(
      (item: { product: { id: string } }) => item.product.id,
    )

    const { data: products, error: productsError } = await locals.supabase
      .from('products')
      .select('id, stock')
      .in('id', productIds)
      .eq('store_id', membership.store_id)

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

    const { data: costData } = await locals.supabase
      .from('stock_movements')
      .select('product_id, quantity, unit_cost')
      .in('product_id', productIds)
      .eq('type', 'in')
      .eq('store_id', membership.store_id)

    const avgCostMap: Record<string, number> = {}
    if (costData) {
      const grouped: Record<string, { totalCost: number; totalQty: number }> =
        {}
      for (const row of costData) {
        if (!grouped[row.product_id]) {
          grouped[row.product_id] = { totalCost: 0, totalQty: 0 }
        }
        grouped[row.product_id].totalCost += row.unit_cost * row.quantity
        grouped[row.product_id].totalQty += row.quantity
      }
      for (const [pid, data] of Object.entries(grouped)) {
        avgCostMap[pid] = data.totalQty > 0 ? data.totalCost / data.totalQty : 0
      }
    }

    const { data: sale, error: saleError } = await locals.supabase
      .from('sales')
      .insert([
        { total, store_id: membership.store_id, payment_method: paymentMethod },
      ])
      .select()
      .single()

    if (saleError) {
      console.error('Error creating sale:', saleError)
      return { success: false, error: saleError.message }
    }

    const saleItems = items.map(
      (item: { product: { id: string; price: number }; quantity: number }) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_sale: item.product.price,
        cost_at_sale: avgCostMap[item.product.id] ?? 0,
        store_id: membership.store_id,
      }),
    )

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
      const typedItem = item as {
        product: { id: string; stock: number }
        quantity: number
      }

      const movementId = generateUUIDv7()

      const { error: movementError } = await locals.supabase
        .from('stock_movements')
        .insert({
          id: movementId,
          product_id: typedItem.product.id,
          store_id: membership.store_id,
          type: 'out',
          quantity: typedItem.quantity,
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
          p_product_id: typedItem.product.id,
          p_delta: -typedItem.quantity,
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
