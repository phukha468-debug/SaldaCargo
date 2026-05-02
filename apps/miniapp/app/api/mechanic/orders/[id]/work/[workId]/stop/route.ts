import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { stopWork } from '@saldacargo/domain-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; workId: string }> }
) {
  const { workId } = await params;
  const { status } = await request.json() as { status: 'paused' | 'completed' };

  try {
    const supabase = await createClient();
    const result = await stopWork(supabase, workId, status);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
