/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * GET /api/vehicles/public
 * Возвращает список всех активных машин (assets) для упрощенного входа.
 * Использует Admin Client для обхода RLS.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: assets, error } = await supabase
      .from('assets')
      .select('id, short_name, reg_number, odometer_current, status')
      .order('short_name');

    if (error) {
      console.error('[API Vehicles Public] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(assets || [], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[API Vehicles Public] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
