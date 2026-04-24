import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SetupWizard from '@/components/setup/SetupWizard'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('legal_entities')
    .select('id')
    .limit(1)

  if (data && data.length > 0) {
    redirect('/')
  }

  return <SetupWizard />
}
