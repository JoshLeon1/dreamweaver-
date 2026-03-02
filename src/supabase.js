import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://nhkwocgbxxwarkjqenkj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa3dvY2dieHh3YXJranFlbmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzI2NDEsImV4cCI6MjA4Nzc0ODY0MX0.cDOd6i00N_3bP2INL50OCKtbrbjR5yrwKifgSGjm2qs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
