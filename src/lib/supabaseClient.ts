import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
} from "$env/static/public";

const supabaseUrl = PUBLIC_SUPABASE_URL;
const supabaseKey = PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Client with auth enabled for browser
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

// Auth helpers
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
};

export const getSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  return { session, error };
};
