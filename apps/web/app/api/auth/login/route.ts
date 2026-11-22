import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  SESSION_COOKIE_WEB,
  signSessionToken,
  hashPin,
  verifyPin,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }; // 5 попыток за 15 минут

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      phone?: string;
      pin?: string;
    };
    const { phone, pin } = body;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'Телефон и ПИН обязательны' }, { status: 400 });
    }

    const cleanPhone = String(phone).trim();
    const ip = getClientIp(request);
    const rl = checkRateLimit(`web-login:${ip}:${cleanPhone}`, LOGIN_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток входа. Попробуйте позже.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSeconds) },
        },
      );
    }

    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, roles, is_active, pin_code')
      .eq('phone', cleanPhone)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Аккаунт отключён' }, { status: 403 });
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];
    const hasAdminRole = roles.includes('admin') || roles.includes('owner');

    if (!hasAdminRole) {
      return NextResponse.json({ error: 'Нет доступа к панели управления' }, { status: 403 });
    }

    if (!user.pin_code) {
      return NextResponse.json(
        { error: 'ПИН-код не установлен — обратитесь к владельцу' },
        { status: 403 },
      );
    }

    const pinCheck = verifyPin(String(pin), user.pin_code);
    if (!pinCheck.valid) {
      return NextResponse.json({ error: 'Неверный ПИН-код' }, { status: 401 });
    }

    // Прозрачная миграция legacy plaintext PIN на scrypt-хэш при успешном входе
    if (pinCheck.needsRehash) {
      await supabase
        .from('users')
        .update({
          pin_code: hashPin(String(pin)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    const sessionToken = await signSessionToken({
      uid: user.id,
      roles,
      ttlSeconds: 60 * 60 * 24 * 7, // 7 дней
    });

    const response = NextResponse.json({ success: true, name: user.name });
    response.cookies.set(SESSION_COOKIE_WEB, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
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
