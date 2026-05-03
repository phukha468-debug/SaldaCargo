import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { userId, pin } = await request.json();
    console.log('[Auth Debug] Login attempt:', { userId, pin });

    // Временный ПИН-код для всех по требованию заказчика
    if (pin !== '9999') {
      return NextResponse.json({ error: 'Неверный ПИН-код' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('users')
      .select('id, roles, is_active')
      .eq('id', userId)
      .single();

    const user = data as { id: string; roles: string[]; is_active: boolean } | null;

    if (error || !user) {
      console.error('[Auth Debug] User not found:', userId);
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    const cookieStore = await cookies();
    
    // Очищаем старую куку перед установкой новой
    cookieStore.delete('salda_user_id');

    console.log('[Auth Debug] Setting cookie for userId:', user.id);

    // Устанавливаем куку напрямую через cookieStore
    cookieStore.set('salda_user_id', user.id, {
      httpOnly: false, // Для отладки
      secure: false, 
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, 
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[MiniApp Auth Debug] Crash:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
