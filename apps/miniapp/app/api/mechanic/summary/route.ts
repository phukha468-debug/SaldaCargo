import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getMechanicSummary } from '@saldacargo/domain-service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mechanicId = searchParams.get('mechanic_id');

  if (!mechanicId) {
    return NextResponse.json({ error: 'mechanic_id is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const summary = await getMechanicSummary(supabase, mechanicId);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
