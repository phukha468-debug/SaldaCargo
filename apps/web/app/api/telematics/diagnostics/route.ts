import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createWebApiHandler } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/admin';

const querySchema = z.object({
  asset_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const GET = createWebApiHandler(
  {
    roles: ['owner', 'admin', 'dispatcher'],
    requiredModule: 'transport',
    querySchema,
    routeName: 'GET /api/telematics/diagnostics',
  },
  async ({ auth, query }) => {
    const supabase = createAdminClient();

    const [{ data: assets }, { data: states }] = await Promise.all([
      supabase
        .from('assets')
        .select('id, reg_number, short_name, wialon_id, odometer_current, odometer_offset_km')
        .eq('organization_id', auth.organizationId)
        .eq('status', 'active')
        .order('short_name', { ascending: true }),
      supabase
        .from('vehicle_telematics_state')
        .select(
          'asset_id, state, external_unit_id, last_msg_ts, last_lat, last_lon, last_speed, last_odometer_km, transit_entered_at, updated_at',
        )
        .eq('organization_id', auth.organizationId),
    ]);

    const stateMap = new Map((states ?? []).map((s) => [s.asset_id, s]));

    const vehicles = (assets ?? []).map((a) => ({
      id: a.id,
      reg_number: a.reg_number,
      short_name: a.short_name,
      wialon_id: a.wialon_id,
      odometer_current: a.odometer_current,
      odometer_offset_km: a.odometer_offset_km,
      telematics: stateMap.get(a.id) ?? null,
    }));

    let eventsQuery = supabase
      .from('telematics_events')
      .select(
        'id, asset_id, order_id, trip_id, source, decision, reason_code, reason_text, state_before, state_after, telemetry_snapshot, created_at',
      )
      .eq('organization_id', auth.organizationId)
      .order('created_at', { ascending: false })
      .limit(query.limit);

    if (query.asset_id) {
      eventsQuery = eventsQuery.eq('asset_id', query.asset_id);
    }

    const { data: events, error } = await eventsQuery;
    if (error) {
      return NextResponse.json(
        { error: `Ошибка загрузки журнала телематики: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      vehicles,
      events: events ?? [],
    });
  },
);
