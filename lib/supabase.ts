import { createClient } from "@supabase/supabase-js";

let supabaseClient:
  | ReturnType<typeof createClient>
  | null = null;
let supabaseAdminClient:
  | ReturnType<typeof createClient>
  | null = null;

function requireEnv(
  name:
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    | "SUPABASE_SERVICE_ROLE_KEY"
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    );
  }

  return supabaseClient;
}

export function getSupabaseAdminClient() {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return supabaseAdminClient;
}
