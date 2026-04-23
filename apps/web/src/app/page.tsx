import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import MoneyMap from '@/components/dashboard/MoneyMap'

export default async function HomePage() {
  const supabase = createAdminClient()
  const { data } = await (supabase
    .from('legal_entities') as any)
    .select('id')
    .limit(1)

  if (!data || data.length === 0) {
    redirect('/setup')
  }

  redirect('/money-map')
}
