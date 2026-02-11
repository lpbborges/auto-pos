import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const filter = url.searchParams.get("filter") || "all";

  let query = locals.supabase
    .from("sales")
    .select(
      `
      *,
      sale_items (
        *,
        product:products (name)
      )
    `,
    )
    .order("created_at", { ascending: false });

  // Apply date filters
  const now = new Date();

  if (filter === "today") {
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    query = query.gte("created_at", startOfDay.toISOString());
  } else if (filter === "week") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte("created_at", sevenDaysAgo.toISOString());
  } else if (filter === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    query = query.gte("created_at", startOfMonth.toISOString());
  }

  const { data: sales, error } = await query;

  if (error) {
    console.error("Error loading sales:", error);
    return { sales: [], filter, totalRevenue: 0 };
  }

  const salesList = sales ?? [];
  const totalRevenue = salesList.reduce(
    (sum, sale) => sum + (sale.total || 0),
    0,
  );

  return { sales: salesList, filter, totalRevenue };
};
