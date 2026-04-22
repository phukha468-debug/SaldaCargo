import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import SetupWizard from '@/components/setup/SetupWizard'

export default async function SetupPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('legal_entities')
    .select('id')
    .limit(1)

  if (data && data.length > 0) {
    redirect('/')
  }

  return <SetupWizard />
}
