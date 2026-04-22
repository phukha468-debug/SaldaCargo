import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('trips')
    .update({ status: 'approved' })
    .eq('id', tripId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Logic to trigger balance updates for driver/loader could be here via Supabase triggers
  // or additional service calls.

  return NextResponse.json(data);
}
