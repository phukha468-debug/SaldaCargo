import { createClient } from '@supabase/supabase-js'
import type { Database } from '@saldacargo/shared-types'

// ТОЛЬКО для серверных API Routes — никогда не импортировать на клиенте!
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
