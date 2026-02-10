import { json, error } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { PRIVATE_SUPABASE_SERVICE_ROLE_KEY } from "$env/static/private";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { z } from "zod";
import type { RequestEvent } from "@sveltejs/kit";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  storeId: z.string().uuid("Invalid store ID"),
});

// Admin client with service role for user creation
const adminClient = createClient(
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST({ request }: RequestEvent) {
  try {
    const body = await request.json();

    // Validate input
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      throw error(
        400,
        `Validation failed: ${result.error.errors.map((e) => e.message).join(", ")}`,
      );
    }

    const { email, password, storeId } = result.data;

    // Verify store exists
    const { data: store, error: storeError } = await adminClient
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      throw error(400, "Store not found");
    }

    // Create user
    const { data: userData, error: authError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      throw error(400, authError.message);
    }

    if (!userData.user) {
      throw error(500, "Failed to create user");
    }

    // Create membership record
    const { error: membershipError } = await adminClient
      .from("store_memberships")
      .insert({
        user_id: userData.user.id,
        store_id: storeId,
      });

    if (membershipError) {
      // Attempt to clean up the created user if membership fails
      await adminClient.auth.admin.deleteUser(userData.user.id);
      throw error(500, "Failed to create store membership");
    }

    return json({
      success: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        storeId,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
}
