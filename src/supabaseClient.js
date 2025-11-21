// file: supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// HƯỚNG DẪN:
// 1. Vào Supabase Dashboard > Settings > API
// 2. Copy "Project URL" dán vào SUPABASE_URL
// 3. Copy "anon public" key dán vào SUPABASE_ANON_KEY

const SUPABASE_URL = 'https://fjpgxvroomyiphhgnezo.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_lLMFT2OAjmU2bfp9Uq1RpQ_FzUa0mFi'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)