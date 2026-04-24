import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@saldacargo/shared-types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = createAdminClient();

  // 1. Update trip status to approved
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .update({ 
      status: 'approved', 
      lifecycle_status: 'approved' 
    } as Database['public']['Tables']['trips']['Update'])
    .eq('id', tripId)
    .select()
    .single();

  if (tripError) return NextResponse.json({ error: tripError.message }, { status: 500 });
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

  // 2. Sync odometer to vehicle if trip has odometer_end
  const t = trip as Database['public']['Tables']['trips']['Row'];
  if (t.asset_id && t.odometer_end) {
    const { error: assetError } = await supabase
      .from('assets')
      .update({ 
        odometer_current: t.odometer_end 
      } as Database['public']['Tables']['assets']['Update'])
      .eq('id', t.asset_id);

    if (assetError) {
        console.error('Error syncing odometer to asset:', assetError);
    }
  }

  return NextResponse.json(trip);
}

