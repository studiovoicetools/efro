import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('âŒ Supabase-Keys fehlen. Bitte .env.local prÃ¼fen!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

