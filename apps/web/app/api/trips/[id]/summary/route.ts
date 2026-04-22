import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params;
  const supabase = createAdminClient();

  const { data: trip } = await supabase
    .from('trips')
    .select('*, driver:users(*), vehicle:assets(*)')
    .eq('id', tripId)
    .single();

  const { data: orders } = await supabase
    .from('trip_orders')
    .select('*')
    .eq('trip_id', tripId);

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  return NextResponse.json({
    trip,
    orders,
    expenses,
    summary: {
      totalRevenue: orders?.reduce((s, o) => s + Number(o.amount), 0),
      totalProfit: trip?.profit
    }
  });
}
