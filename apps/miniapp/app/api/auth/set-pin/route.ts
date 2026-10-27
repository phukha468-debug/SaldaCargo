/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** POST /api/auth/set-pin — устанавливает личный 4-значный PIN сотрудника */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { user_id?: string; pin?: string; current_pin?: string };
    const { user_id, pin, current_pin } = body;

    if (!user_id || !pin) {
      return NextResponse.json({ error: 'Не указан пользователь или PIN-код' }, { status: 400 });
    }

    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return NextResponse.json(
        { error: 'PIN-код должен состоять ровно из 4 цифр' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Проверяем существование пользователя
    const { data: user, error: findError } = await (supabase.from('users') as any)
      .select('id, name, is_active, pin_code')
      .eq('id', user_id)
      .maybeSingle();

    if (findError || !user) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Сотрудник деактивирован' }, { status: 403 });
    }

    // Если передан current_pin и PIN уже установлен — проверяем совпадение
    if (
      current_pin !== undefined &&
      user.pin_code &&
      String(user.pin_code).trim() !== String(current_pin).trim()
    ) {
      return NextResponse.json({ error: 'Неверный текущий PIN-код для смены' }, { status: 403 });
    }

    // Сохраняем PIN
    const { error: updateError } = await (supabase.from('users') as any)
      .update({
        pin_code: cleanPin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'PIN-код успешно установлен' });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}
