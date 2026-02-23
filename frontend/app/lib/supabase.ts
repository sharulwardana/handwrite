import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
    console.warn('[Supabase] ENV belum diset. Fitur cloud history dinonaktifkan.')
}

export const supabaseConfigured = isConfigured;

// Hanya buat client jika ENV sudah diset, hindari request ke placeholder domain
export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-key-no-network-calls');