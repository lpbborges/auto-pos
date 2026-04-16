import type { PageServerLoad, Actions } from './$types'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, url }) => {
  const filter = url.searchParams.get('filter') || 'all'

  const { session } = await locals.safeGetSession()
  if (!session) {
    return { sales: [], filter, totalRevenue: 0, totalProfit: 0 }
  }

  if (!locals.storeId) {
    return { sales: [], filter, totalRevenue: 0, totalProfit: 0 }
  }

  let query = locals.supabase
    .from('sales')
    .select(
      `
      id, total, created_at, sold_at, payment_method,
      sale_items (
        *,
        product:products (name)
      )
    `,
    )
    .eq('store_id', locals.storeId)
    .is('cancelled_at', null)
    .order('sold_at', { ascending: false })
    .limit(200)

  const now = new Date()

  if (filter === 'today') {
    query = query.eq('sold_at', now.toISOString().split('T')[0])
  } else if (filter === 'week') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    query = query.gte('sold_at', sevenDaysAgo.toISOString().split('T')[0])
  } else if (filter === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    query = query.gte('sold_at', startOfMonth.toISOString().split('T')[0])
  }

  const { data: sales, error } = await query

  if (error) {
    console.error('Error loading sales:', error)
    return { sales: [], filter, totalRevenue: 0, totalProfit: 0 }
  }

  const salesList = (sales ?? []).map((sale) => {
    const saleProfit = (sale.sale_items ?? []).reduce(
      (
        sum: number,
        item: { price_at_sale: number; cost_at_sale: number; quantity: number },
      ) =>
        sum + (item.price_at_sale - (item.cost_at_sale ?? 0)) * item.quantity,
      0,
    )
    return { ...sale, profit: saleProfit }
  })

  const totalRevenue = salesList.reduce(
    (sum, sale) => sum + (sale.total || 0),
    0,
  )

  const totalProfit = salesList.reduce(
    (sum, sale) => sum + (sale.profit || 0),
    0,
  )

  return { sales: salesList, filter, totalRevenue, totalProfit }
}

export const actions: Actions = {
  undoSale: async ({ request, locals }) => {
    const formData = await request.formData()
    const saleId = formData.get('saleId') as string

    if (!saleId) {
      return fail(400, { error: 'ID da venda não informado' })
    }

    const { session } = await locals.safeGetSession()
    if (!session) {
      return fail(401, { error: 'Não autorizado' })
    }

    if (!locals.storeId) {
      return fail(403, { error: 'Usuário não pertence a uma loja' })
    }

    const { data: sale, error: saleError } = await locals.supabase
      .from('sales')
      .select('id, sale_items(id, product_id, quantity)')
      .eq('id', saleId)
      .eq('store_id', locals.storeId)
      .is('cancelled_at', null)
      .single()

    if (saleError || !sale) {
      return fail(404, { error: 'Venda não encontrada ou já cancelada' })
    }

    const saleItems = sale.sale_items as {
      id: string
      product_id: string
      quantity: number
    }[]

    const updatedAt = new Date().toISOString()
    const rpcResults = await Promise.all(
      saleItems.map((item) =>
        locals.supabase.rpc('adjust_product_stock', {
          p_product_id: item.product_id,
          p_delta: item.quantity,
          p_updated_at: updatedAt,
        }),
      ),
    )

    for (const { data: adjustResult, error: stockError } of rpcResults) {
      if (stockError) {
        console.error('Error restoring stock:', stockError)
        return fail(500, { error: 'Erro ao restaurar estoque' })
      }
      if (!adjustResult?.success) {
        return fail(500, {
          error: adjustResult?.error || 'Falha ao restaurar estoque',
        })
      }
    }

    await locals.supabase.from('stock_movements').insert(
      saleItems.map((item) => ({
        product_id: item.product_id,
        store_id: locals.storeId,
        type: 'in',
        quantity: item.quantity,
        reason: 'Cancelamento de venda',
        sale_id: sale.id,
      })),
    )

    const { error: updateError } = await locals.supabase
      .from('sales')
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: session.user.id,
      })
      .eq('id', sale.id)

    if (updateError) {
      console.error('Error cancelling sale:', updateError)
      return fail(500, { error: 'Erro ao cancelar venda' })
    }

    return { success: true }
  },
}
