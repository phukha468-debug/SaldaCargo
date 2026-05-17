/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * PATCH /api/mechanic/orders/:id/works/:workId
 * Механик запрашивает доп. работу (extra_work_status = 'pending_approval')
 * или завершает работу (status = 'completed', actual_minutes)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;
  const cookieStore = await cookies();
  const userId = cookieStore.get('salda_user_id')?.value;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { action, actual_minutes, mechanic_note } = body as {
    action: 'complete' | 'request_extra';
    actual_minutes?: number;
    mechanic_note?: string;
  };

  const supabase = createAdminClient();

  if (action === 'complete') {
    const update: Record<string, any> = { status: 'completed' };
    if (actual_minutes !== undefined) update.actual_minutes = actual_minutes;
    if (mechanic_note) update.notes = mechanic_note;

    const { data, error } = await (supabase.from('service_order_works') as any)
      .update(update)
      .eq('id', workId)
      .select('id, status, actual_minutes')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
