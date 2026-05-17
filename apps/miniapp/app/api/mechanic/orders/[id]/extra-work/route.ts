/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/mechanic/orders/:id/extra-work
 * Механик обнаружил доп. работу в процессе — запрашивает согласование у Администратора.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { work_catalog_id, custom_work_name, mechanic_note } = body as {
    work_catalog_id?: string;
    custom_work_name?: string;
    mechanic_note: string;
  };

  if (!work_catalog_id && !custom_work_name) {
    return NextResponse.json(
      { error: 'work_catalog_id или custom_work_name обязательны' },
      { status: 400 },
    );
  }
  if (!mechanic_note?.trim()) {
    return NextResponse.json(
      { error: 'mechanic_note обязателен — объясни что обнаружил' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Получаем нормачасы из каталога если указан
  let normMinutes = 60;
  if (work_catalog_id) {
    const { data: wc } = await (supabase.from('work_catalog') as any)
      .select('norm_minutes')
      .eq('id', work_catalog_id)
      .single();
    if (wc) normMinutes = wc.norm_minutes;
  }

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      service_order_id: orderId,
      work_catalog_id: work_catalog_id ?? null,
      custom_work_name: custom_work_name ?? null,
      norm_minutes: normMinutes,
      price_client: 0,
      status: 'pending',
      requires_admin_review: true,
      extra_work_status: 'pending_approval',
      extra_work_mechanic_note: mechanic_note.trim(),
    })
    .select(
      'id, extra_work_status, custom_work_name, norm_minutes, extra_work_mechanic_note, work:work_catalog(name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
