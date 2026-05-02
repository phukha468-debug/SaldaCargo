import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** POST /api/trips/:id/return — вернуть рейс водителю на доработку */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Сбрасываем статус на in_progress и lifecycle на draft (или returned)
  // Также очищаем конечные данные, чтобы водитель заполнил их заново
  const { error } = await supabase
    .from('trips')
    .update({ 
      status: 'in_progress',
      lifecycle_status: 'returned',
      odometer_end: null,
      ended_at: null,
      driver_note: null // опционально: оставить или сбросить
    })
    .eq('id', id);


  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
