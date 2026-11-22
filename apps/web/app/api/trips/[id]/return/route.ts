import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { createWebApiHandler } from '@/lib/api';
import { isUuid } from '@saldacargo/shared';
import { invalidateWalletsCache, resolveOrganizationFinanceIds } from '@saldacargo/domain-service';

/** POST /api/trips/:id/return — вернуть рейс водителю на доработку */
export const POST = createWebApiHandler<undefined, Record<string, string>, { id: string }>(
  {
    routeName: 'web:/api/trips/[id]/return',
    roles: ['admin', 'owner'],
    requiredModule: 'transport',
  },
  async ({ params, auth }) => {
    const { id } = params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: 'Некорректный ID рейса' }, { status: 400 });
    }

    const ids = resolveOrganizationFinanceIds(auth.orgSettings);
    const supabase = createAdminClient();
    const { data: tripData } = await supabase
      .from('trips')
      .select('trip_number')
      .eq('id', id)
      .eq('organization_id', auth.organizationId)
      .single();

    // Удаляем транзакции рейса, чтобы избежать дублей при повторном апруве
    await Promise.all([
      supabase
        .from('transactions')
        .delete()
        .eq('trip_id', id)
        .eq('organization_id', auth.organizationId),
      ...(tripData?.trip_number
        ? [
            supabase
              .from('transactions')
              .delete()
              .eq('organization_id', auth.organizationId)
              .ilike('description', `%рейс №${tripData.trip_number}%`)
              .in('category_id', [ids.payrollDriverCat, ids.payrollLoaderCat])
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
      .eq('id', id)
      .eq('organization_id', auth.organizationId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase
      .from('trip_orders')
      .update({ lifecycle_status: 'draft' })
      .eq('trip_id', id)
      .eq('organization_id', auth.organizationId)
      .neq('lifecycle_status', 'cancelled');

    await supabase
      .from('orders')
      .update({ status: 'pending_review', updated_at: new Date().toISOString() })
      .eq('active_trip_id', id)
      .eq('organization_id', auth.organizationId);

    invalidateWalletsCache(auth.organizationId);
    return NextResponse.json({ success: true });
  },
);
