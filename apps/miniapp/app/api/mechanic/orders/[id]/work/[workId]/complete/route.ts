/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;
  const { actual_minutes } = await request.json();

  if (typeof actual_minutes !== 'number') {
    return NextResponse.json({ error: 'actual_minutes is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from('service_order_works') as any)
      .update({
        status: 'completed',
        actual_minutes,
      })
      .eq('id', workId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Auto-stop any running time logs just in case (cleanup)
    await (supabase.from('service_order_work_time_logs') as any)
      .update({
        status: 'completed',
        stopped_at: new Date().toISOString(),
      })
      .eq('work_id', workId)
      .eq('status', 'running');

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
