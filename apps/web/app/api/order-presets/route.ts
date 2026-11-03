/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('order_presets') as any)
      .select(
        '*, client:counterparties!order_presets_client_counterparty_id_fkey(*), forwarder:counterparties!order_presets_forwarder_counterparty_id_fkey(*), loading_point:loading_points_directory(*)',
      )
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ presets: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
