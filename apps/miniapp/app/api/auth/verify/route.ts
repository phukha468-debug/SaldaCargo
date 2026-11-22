import { NextResponse } from 'next/server';
import { verifyMaxContact } from '@saldacargo/domain-identity';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SESSION_COOKIE_MINIAPP,
  signSessionToken,
  getMaxBotEnv,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';
import { getMiniappCookieOptions } from '@/lib/auth/server';

const VERIFY_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`miniapp-verify:${ip}`, VERIFY_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Слишком много попыток. Попробуйте позже.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const { vcf_info, hash, phone } = (await request.json().catch(() => ({}))) as {
    vcf_info?: string;
    hash?: string;
    phone?: string;
  };
  const botToken = getMaxBotEnv()?.token;

  if (!botToken) {
    return NextResponse.json({ error: 'MAX_BOT_TOKEN не настроен' }, { status: 503 });
  }

  if (!vcf_info || !hash || !phone) {
    return NextResponse.json({ error: 'Некорректные данные верификации' }, { status: 400 });
  }

  // 1. Проверяем подпись МАКС
  const isValid = verifyMaxContact(vcf_info, hash, botToken);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid contact signature' }, { status: 401 });
  }

  // 2. Ищем пользователя по номеру телефона в БД
  const supabaseAdmin = createAdminClient();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, roles, is_active')
    .eq('phone', phone)
    .single();

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: 'User not found or access denied' }, { status: 403 });
  }

  // 3. Устанавливаем криптографически подписанную httpOnly сессию
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const token = await signSessionToken({
    uid: user.id,
    roles,
    ttlSeconds: 60 * 60 * 24 * 30,
  });

  const response = NextResponse.json({ success: true, role: roles[0] ?? null });
  response.cookies.set(SESSION_COOKIE_MINIAPP, token, getMiniappCookieOptions(60 * 60 * 24 * 30));

  return response;
}
