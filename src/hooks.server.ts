import { createServerClient } from "@supabase/ssr";
import { redirect, type Handle } from "@sveltejs/kit";
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY } from "$env/static/public";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        get: (key) => event.cookies.get(key),
        set: (key, value, options) => {
          event.cookies.set(key, value, { ...options, path: "/" });
        },
        remove: (key, options) => {
          event.cookies.delete(key, { ...options, path: "/" });
        },
      },
    }
  );

  // Get session
  const {
    data: { session },
  } = await event.locals.supabase.auth.getSession();

  // Set session and user on locals
  event.locals.session = session;
  event.locals.user = session?.user ?? null;

  // Check if route requires authentication
  const isAuthRoute = event.url.pathname === "/login";
  const isApiRoute = event.url.pathname.startsWith("/api/");
  const isPublicRoute = isAuthRoute || isApiRoute;

  // If not authenticated and trying to access protected route, redirect to login
  if (!session && !isPublicRoute) {
    throw redirect(303, "/login");
  }

  // If authenticated and trying to access login page, redirect to home
  if (session && isAuthRoute) {
    throw redirect(303, "/");
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === "content-range" || name === "x-supabase-api-version";
    },
  });
};
