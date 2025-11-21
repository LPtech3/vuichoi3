import { createClient } from '@supabase/supabase-js'

// Thay URL & KEY bằng của bạn
const SUPABASE_URL = 'https://ichaildtkuvlplmarotb.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_YQPP-swTaL62ntFZg1vxcA_mCNoQ9Km'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
