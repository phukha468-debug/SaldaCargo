/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { invalidateExpCache, STORAGE_LIMITS } from '../route';

export async function POST(request: Request) {
  try {
    invalidateExpCache();
    const supabase = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const forceLimit = Number(body.batch_size || STORAGE_LIMITS.PURGE_BATCH);

    const { data: rows, error: getErr } = await (supabase.from('audit_log') as any)
      .select('id, new_values, changed_at')
      .eq('table_name', 'ati_expeditor_orders')
      .order('changed_at', { ascending: true });

    if (getErr || !rows) {
      return NextResponse.json({ error: 'Ошибка получения данных' }, { status: 500 });
    }

    // Удаляем в первую очередь старые завершённые (stage === 6) или отменённые
    const closedCandidates = rows.filter((r: any) => {
      const v = r.new_values || {};
      return v.stage === 6 || v.is_cancelled === true;
    });

    const toDeleteIds = closedCandidates.slice(0, forceLimit).map((r: any) => r.id);

    if (toDeleteIds.length === 0) {
      return NextResponse.json({
        success: true,
        purged_count: 0,
        message: 'Нет закрытых или архивных рейсов для удаления. Активные рейсы не затрагиваются.',
      });
    }

    const { error: delErr } = await (supabase.from('audit_log') as any)
      .delete()
      .in('id', toDeleteIds)
      .eq('table_name', 'ati_expeditor_orders');

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    invalidateExpCache();

    return NextResponse.json({
      success: true,
      purged_count: toDeleteIds.length,
      message: `Успешно удалено ${toDeleteIds.length} старых завершённых заявок. Свободный лимит увеличен.`,
    });
  } catch (err: any) {
    console.error('Fatal POST /api/ati-expeditor/purge error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
