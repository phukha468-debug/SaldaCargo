import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  try {
    const { phone, pin } = await request.json();
    console.log('[Auth Debug] Attempt:', { phone, pin });

    if (pin !== '0911') {
      return NextResponse.json({ error: 'Неверный ПИН-код' }, { status: 401 });
    }

    // Создаем клиент напрямую с ключами
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const cleanPhone = phone.trim();

    // 1. Пытаемся найти пользователя
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, roles, is_active, phone')
      .eq('phone', cleanPhone)
      .single();

    if (error) {
      console.error('[Auth Debug] Error:', error.message);
      
      // 2. Если не нашли, выведем ВСЕХ пользователей для сверки
      const { data: all } = await supabase.from('users').select('name, phone');
      const phones = all?.map(u => `"${u.phone}"`).join(', ') || 'пусто';
      
      return NextResponse.json({ 
        error: `Пользователь не найден (${cleanPhone}). В базе есть: ${phones}` 
      }, { status: 404 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('salda_auth_token', user.id, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Ошибка сервера: ' + message }, { status: 500 });
  }
}

