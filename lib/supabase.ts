import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the server
export const createServerSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables")
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Create a singleton client for the client-side
let clientSideSupabase: ReturnType<typeof createClient> | null = null

export const createClientSupabaseClient = () => {
  if (clientSideSupabase) {
    return clientSideSupabase
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  clientSideSupabase = createClient(supabaseUrl, supabaseAnonKey)
  return clientSideSupabase
}

