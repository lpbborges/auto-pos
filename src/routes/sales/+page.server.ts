import type { PageServerLoad, Actions } from './$types'
import { fail } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ locals, url }) => {
  const filter = url.searchParams.get('filter') || 'all'

  const { session } = await locals.safeGetSession()
  if (!session) {
    return { sales: [], filter, totalRevenue: 0, totalProfit: 0 }
  }

  const { data: membership } = await locals.supabase
    .from('store_memberships')
    .select('store_id')
    .eq('user_id', session.user.id)
    .single()

  if (!membership) {
    return { sales: [], filter, totalRevenue: 0, totalProfit: 0 }
  }

  let query = locals.supabase
    .from('sales')
    .select(
      `
      *,
      sale_items (
        *,
        product:products (name)
      )
    `,
    )
    .eq('store_id', membership.store_id)
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })

  const now = new Date()

  if (filter === 'today') {
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    )
    query = query.gte('created_at', startOfDay.toISOString())
  } else if (filter === 'week') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    query = query.gte('created_at', sevenDaysAgo.toISOString())
  } else if (filter === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    query = query.gte('created_at', startOfMonth.toISOString())
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

    const { data: membership } = await locals.supabase
      .from('store_memberships')
      .select('store_id')
      .eq('user_id', session.user.id)
      .single()

    if (!membership) {
      return fail(403, { error: 'Usuário não pertence a uma loja' })
    }

    const { data: sale, error: saleError } = await locals.supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('id', saleId)
      .eq('store_id', membership.store_id)
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

    for (const item of saleItems) {
      const { data: adjustResult, error: stockError } =
        await locals.supabase.rpc('adjust_product_stock', {
          p_product_id: item.product_id,
          p_delta: item.quantity,
          p_updated_at: new Date().toISOString(),
        })

      if (stockError) {
        console.error('Error restoring stock:', stockError)
        return fail(500, { error: 'Erro ao restaurar estoque' })
      }

      if (!adjustResult?.success) {
        return fail(500, {
          error: adjustResult?.error || 'Falha ao restaurar estoque',
        })
      }

      await locals.supabase.from('stock_movements').insert({
        product_id: item.product_id,
        store_id: membership.store_id,
        type: 'in',
        quantity: item.quantity,
        reason: 'Cancelamento de venda',
        sale_id: sale.id,
      })
    }

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
