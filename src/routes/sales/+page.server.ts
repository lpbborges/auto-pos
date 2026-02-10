import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const { data: sales, error } = await locals.supabase
    .from("sales")
    .select(`
      *,
      sale_items (
        *,
        product:products (name)
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading sales:", error);
    return { sales: [] };
  }

  return { sales: sales ?? [] };
};
