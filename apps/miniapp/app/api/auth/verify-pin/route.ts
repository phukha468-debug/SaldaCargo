/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/auth/verify-pin — проверяет PIN администратора */
export async function POST(request: Request) {
  const body = (await request.json()) as { user_id?: string; pin?: string };
  const { user_id, pin } = body;

  if (!user_id || !pin) {
    return NextResponse.json({ error: 'Неверные данные' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user } = await (supabase.from('users') as any)
    .select('pin_code')
    .eq('id', user_id)
    .single();

  if (!user?.pin_code) {
    return NextResponse.json({ error: 'PIN не установлен' }, { status: 403 });
  }

  if (user.pin_code !== pin) {
    return NextResponse.json({ error: 'Неверный PIN-код' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
