import { createClient } from '@supabase/supabase-js';
import type { Database } from '@saldacargo/shared-types';

/**
 * Создает клиент Supabase с сервисным ключом.
 * Используется ТОЛЬКО на сервере для обхода RLS в специфических случаях,
 * когда стандартная авторизация Supabase не применима.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
