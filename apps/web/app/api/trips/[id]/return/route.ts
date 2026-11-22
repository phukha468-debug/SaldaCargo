import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { isUuid } from '@saldacargo/shared';
import { invalidateWalletsCache } from '@saldacargo/domain-service';

const PAYROLL_DRIVER_CAT = 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';
const PAYROLL_LOADER_CAT = '18792fa8-fda8-472d-8e04-e19d2c6c053c';

/** POST /api/trips/:id/return — вернуть рейс водителю на доработку */
export const POST = createWebApiHandler<undefined, Record<string, string>, { id: string }>(
  {
    routeName: 'web:/api/trips/[id]/return',
    roles: ['admin', 'owner'],
  },
  async ({ params }) => {
    const { id } = params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Некорректный ID рейса' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: tripData } = await supabase
      .from('trips')
      .select('trip_number')
      .eq('id', id)
      .single();

    // Удаляем транзакции рейса, чтобы избежать дублей при повторном апруве
    await Promise.all([
      supabase.from('transactions').delete().eq('trip_id', id),
      ...(tripData?.trip_number
        ? [
            supabase
              .from('transactions')
              .delete()
              .ilike('description', `%рейс №${tripData.trip_number}%`)
              .in('category_id', [PAYROLL_DRIVER_CAT, PAYROLL_LOADER_CAT])
              .is('trip_id', null),
          ]
        : []),
    ]);

    const { error } = await supabase
      .from('trips')
      .update({
        status: 'completed',
        lifecycle_status: 'returned',
      })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase
      .from('trip_orders')
      .update({ lifecycle_status: 'draft' })
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    await supabase
      .from('orders')
      .update({ status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('active_trip_id', id);

    invalidateWalletsCache();
    return NextResponse.json({ success: true });
  },
);
