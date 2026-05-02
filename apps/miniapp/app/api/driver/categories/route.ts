/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** GET /api/driver/categories — список категорий расходов для водителя */
export async function GET() {
  const supabase = await createClient();

  // Для водителя важны: FUEL, REPAIR_PARTS, и возможно WASH, PARKING если они есть
  const { data, error } = await (supabase
    .from('transaction_categories')
    .select('id, name, code')
    .eq('direction', 'expense')
    .order('name') as any);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  // Фильтруем те, которые обычно нужны водителю в рейсе
  const driverCodes = ['FUEL', 'REPAIR_PARTS', 'WASH', 'PARKING', 'OTHER_EXPENSE'];
  const filtered = (data ?? []).filter((c: any) => driverCodes.includes(c.code) || !c.code);

  return NextResponse.json(filtered);
}
