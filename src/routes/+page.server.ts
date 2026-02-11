import { redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  // Fetch products
  const { data: products, error: productsError } = await locals.supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (productsError) {
    console.error("Error loading products:", productsError);
  }

  // Fetch user store membership
  let store = null;
  if (user) {
    const { data: membership } = await locals.supabase
      .from("store_memberships")
      .select("store_id")
      .eq("user_id", user.id)
      .single();

    if (membership) {
      const { data: storeData } = await locals.supabase
        .from("stores")
        .select("id, name")
        .eq("id", membership.store_id)
        .single();

      if (storeData) {
        store = { id: storeData.id, name: storeData.name };
      }
    }
  }

  return {
    products: products ?? [],
    user: user?.email ? { email: user.email, id: user.id } : null,
    store,
  };
};

export const actions: Actions = {
  createProduct: async ({ request, locals }) => {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const price = parseFloat(formData.get("price") as string);
    const stock = parseInt(formData.get("stock") as string);

    if (!name || isNaN(price) || isNaN(stock)) {
      return { success: false, error: "Invalid product data" };
    }

    // Get user's store membership
    const user = locals.user;
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data: membership } = await locals.supabase
      .from("store_memberships")
      .select("store_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: "User is not a member of any store" };
    }

    const { data, error } = await locals.supabase
      .from("products")
      .insert([{ name, price, stock, store_id: membership.store_id }])
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      return { success: false, error: error.message };
    }

    return { success: true, product: data };
  },

  updateProduct: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const price = parseFloat(formData.get("price") as string);
    const stock = parseInt(formData.get("stock") as string);

    if (!id || !name || isNaN(price) || isNaN(stock)) {
      return { success: false, error: "Invalid product data" };
    }

    const { data, error } = await locals.supabase
      .from("products")
      .update({ name, price, stock, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      return { success: false, error: error.message };
    }

    return { success: true, product: data };
  },

  deleteProduct: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get("id") as string;

    if (!id) {
      return { success: false, error: "Product ID is required" };
    }

    const { error } = await locals.supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting product:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  processSale: async ({ request, locals }) => {
    const formData = await request.formData();
    const itemsJson = formData.get("items") as string;
    const total = parseFloat(formData.get("total") as string);

    if (!itemsJson || isNaN(total)) {
      return { success: false, error: "Invalid sale data" };
    }

    const items = JSON.parse(itemsJson);

    // Get user's store membership
    const user = locals.user;
    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const { data: membership } = await locals.supabase
      .from("store_memberships")
      .select("store_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return { success: false, error: "User is not a member of any store" };
    }

    // Create the sale first
    const { data: sale, error: saleError } = await locals.supabase
      .from("sales")
      .insert([{ total, store_id: membership.store_id }])
      .select()
      .single();

    if (saleError) {
      console.error("Error creating sale:", saleError);
      return { success: false, error: saleError.message };
    }

    // Insert sale items
    const saleItems = items.map(
      (item: { product: { id: string; price: number }; quantity: number }) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_sale: item.product.price,
        store_id: membership.store_id,
      }),
    );

    const { error: itemsError } = await locals.supabase
      .from("sale_items")
      .insert(saleItems);

    if (itemsError) {
      console.error("Error creating sale items:", itemsError);
      return { success: false, error: itemsError.message };
    }

    // Update stock for each item
    for (const item of items) {
      const { error: stockError } = await locals.supabase
        .from("products")
        .update({
          stock: item.product.stock - item.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.product.id);

      if (stockError) {
        console.error("Error updating stock:", stockError);
        return { success: false, error: stockError.message };
      }
    }

    return { success: true, sale };
  },

  logout: async ({ locals }) => {
    const { error } = await locals.supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      return { success: false, error: error.message };
    }

    throw redirect(303, "/login");
  },
};
