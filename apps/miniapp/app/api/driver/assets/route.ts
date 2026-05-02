/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/driver/assets — список активных машин для dropdown */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    console.log(`[API Assets] Connecting to: ${supabaseUrl}`);
    
    const { data, error } = await supabase
      .from('assets')
      .select('*');

    if (error) {
      console.error('[API Assets] DB Error:', error);
      return NextResponse.json([{ id: 'err', short_name: 'ОШИБКА БД: ' + error.message, reg_number: 'ERR' }]);
    }

    if (!data || data.length === 0) {
      console.log('[API Assets] DB IS EMPTY');
      return NextResponse.json([{ id: 'empty', short_name: 'БАЗА ПУСТА (0 строк)', reg_number: 'EMPTY' }]);
    }

    console.log(`[API Assets] Found ${data.length} rows`);
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[API Assets] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
