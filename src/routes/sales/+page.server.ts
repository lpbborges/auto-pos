import { supabase } from "$lib/supabaseClient";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const { data: sales, error } = await supabase
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
