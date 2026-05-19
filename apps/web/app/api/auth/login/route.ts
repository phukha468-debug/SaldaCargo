/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { phone, pin } = await request.json();

    if (!phone || !pin) {
      return NextResponse.json({ error: 'Телефон и ПИН обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const cleanPhone = String(phone).trim();

    const { data: user, error } = await (supabase
      .from('users')
      .select('id, name, roles, is_active, pin_code')
      .eq('phone', cleanPhone)
      .single() as any);

    if (error || !user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Аккаунт отключён' }, { status: 403 });
    }

    const hasAdminRole =
      Array.isArray(user.roles) && (user.roles.includes('admin') || user.roles.includes('owner'));

    if (!hasAdminRole) {
      return NextResponse.json({ error: 'Нет доступа к панели управления' }, { status: 403 });
    }

    if (!user.pin_code) {
      return NextResponse.json(
        { error: 'ПИН-код не установлен — обратитесь к владельцу' },
        { status: 403 },
      );
    }

    if (user.pin_code !== String(pin)) {
      return NextResponse.json({ error: 'Неверный ПИН-код' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, name: user.name });
    response.cookies.set('salda_auth_token', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Ошибка сервера: ' + message }, { status: 500 });
  }
}
