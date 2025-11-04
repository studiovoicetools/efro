import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase-Keys fehlen. Bitte .env.local prüfen!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
