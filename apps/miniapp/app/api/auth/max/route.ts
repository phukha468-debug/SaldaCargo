import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/max
 * Авторизация через МАХ Mini App.
 *
 * На MVP: просто проверяем что max_user_id есть в нашей БД.
 * После MVP: добавить верификацию подписи МАХ SDK.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { initData?: { max_user_id?: string } };
  const maxUserId = body.initData?.max_user_id;

  if (!maxUserId) {
    return NextResponse.json({ error: 'Нет данных авторизации' }, { status: 400 });
  }

  const supabase = await createClient();

  // Ищем пользователя в нашей таблице
  const { data, error } = await (supabase
    .from('users')
    .select('id, name, roles, is_active')
    .eq('max_user_id', maxUserId)
    .single() as any);

  const user = data as { id: string; name: string; roles: string[]; is_active: boolean } | null;

  if (error || !user) {
    return NextResponse.json(
      { error: 'Доступ запрещён. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  if (!user.is_active) {
    return NextResponse.json(
      { error: 'Аккаунт деактивирован. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      roles: user.roles,
    },
  });
}
