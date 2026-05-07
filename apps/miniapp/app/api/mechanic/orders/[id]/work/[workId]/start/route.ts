import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { startWork } from '@saldacargo/domain-service';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> },
) {
  const { workId } = await params;

  try {
    const supabase = createAdminClient();
    const result = await startWork(supabase, workId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // В PostgreSQL триггер может выбросить исключение если таймер уже запущен
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
