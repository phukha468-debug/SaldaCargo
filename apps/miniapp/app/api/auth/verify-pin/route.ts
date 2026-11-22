import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_MINIAPP,
  signSessionToken,
  hashPin,
  verifyPin,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';
import { getMiniappCookieOptions } from '@/lib/auth/server';

const PIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }; // 5 попыток за 15 минут

/** POST /api/auth/verify-pin — проверяет PIN сотрудника и выдаёт подписанную сессию */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { user_id?: string; pin?: string };
  const { user_id, pin } = body;

  if (!user_id || !pin) {
    return NextResponse.json({ error: 'Неверные данные' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`miniapp-pin:${ip}:${user_id}`, PIN_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Слишком много неверных попыток. Попробуйте позже.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      },
    );
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, roles, pin_code, is_active')
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

  const pinCheck = verifyPin(String(pin), user.pin_code);
  if (!pinCheck.valid) {
    return NextResponse.json({ error: 'Неверный PIN-код' }, { status: 403 });
  }

  // Прозрачная миграция legacy plaintext PIN на scrypt-хэш
  if (pinCheck.needsRehash) {
    await supabase
      .from('users')
      .update({
        pin_code: hashPin(String(pin)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
  }

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const token = await signSessionToken({
    uid: user.id,
    roles,
    ttlSeconds: 60 * 60 * 24 * 30, // 30 дней
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_MINIAPP, token, getMiniappCookieOptions(60 * 60 * 24 * 30));

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      role: roles[0] ?? null,
      roles,
    },
  });
}
