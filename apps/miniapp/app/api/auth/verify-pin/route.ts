/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** POST /api/auth/verify-pin — проверяет PIN сотрудника */
export async function POST(request: Request) {
  const body = (await request.json()) as { user_id?: string; pin?: string };
  const { user_id, pin } = body;

  if (!user_id || !pin) {
    return NextResponse.json({ error: 'Неверные данные' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: user, error } = await (supabase.from('users') as any)
    .select('id, name, role, roles, pin_code, is_active')
    .eq('id', user_id)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  if (!user.is_active) {
    return NextResponse.json({ error: 'Пользователь деактивирован' }, { status: 403 });
  }

  if (!user.pin_code) {
    return NextResponse.json({ error: 'PIN не установлен' }, { status: 403 });
  }

  if (String(user.pin_code).trim() !== String(pin).trim()) {
    return NextResponse.json({ error: 'Неверный PIN-код' }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set('salda_user_id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 дней
    path: '/',
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      roles: user.roles,
    },
  });
}
