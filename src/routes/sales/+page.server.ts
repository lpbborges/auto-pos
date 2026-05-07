import type { PageServerLoad } from './$types'

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
    .order('created_at', { ascending: false })

  const now = new Date()

  if (filter === 'today') {
    const startOfDay = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    )
    query = query.gte('created_at', new Date(startOfDay).toISOString())
  } else if (filter === 'week') {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    query = query.gte('created_at', sevenDaysAgo.toISOString())
  } else if (filter === 'month') {
    const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    query = query.gte('created_at', new Date(startOfMonth).toISOString())
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
