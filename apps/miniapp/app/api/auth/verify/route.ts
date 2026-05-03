/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { verifyMaxContact } from '@saldacargo/domain-identity';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  const { vcf_info, hash, phone } = await request.json();
  const botToken = process.env.MAX_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // 1. Проверяем подпись МАКС
  const isValid = verifyMaxContact(vcf_info, hash, botToken);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid contact signature' }, { status: 401 });
  }

  // 2. Ищем пользователя по номеру телефона в БД
  // Используем Admin клиент для обхода RLS, так как запрос идет от неавторизованного пользователя
  const supabaseAdmin = createAdminClient();
  const { data: user, error } = await (supabaseAdmin
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single() as any);

  if (error || !user) {
    return NextResponse.json({ error: 'User not found or access denied' }, { status: 403 });
  }

  // 3. Устанавливаем сессию
  // Для MVP используем защищенную куку с ID пользователя
  const response = NextResponse.json({ success: true, role: user.roles[0] });
  response.cookies.set('salda_user_id', user.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });

  return response;
}
