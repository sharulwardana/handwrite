import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] ENV belum diset. Fitur cloud history dinonaktifkan.')
}

const isConfigured = !!(supabaseUrl && supabaseAnonKey);
export const supabaseConfigured = isConfigured;
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
)