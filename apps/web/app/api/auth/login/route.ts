import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DEFAULT_ORGANIZATION_ID,
  SESSION_COOKIE_WEB,
  signSessionToken,
  hashPin,
  verifyPin,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';

const LOGIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 }; // 5 попыток за 15 минут

function buildPhoneCandidates(rawPhone: string): string[] {
  const trimmed = rawPhone.trim();
  const digits = trimmed.replace(/\D/g, '');
  const set = new Set<string>([trimmed]);
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const rest = digits.slice(1);
    set.add(`+7${rest}`);
    set.add(`8${rest}`);
    set.add(`7${rest}`);
  } else if (digits.length === 10) {
    set.add(`+7${digits}`);
    set.add(`8${digits}`);
  }
  return Array.from(set);
}

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
    const phoneCandidates = buildPhoneCandidates(cleanPhone);
    const ip = getClientIp(request);
    const rl = checkRateLimit(
      `web-login:${ip}:${phoneCandidates[0] ?? cleanPhone}`,
      LOGIN_RATE_LIMIT,
    );
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
    const { data: matchedUsers, error } = await supabase
      .from('users')
      .select('id, name, roles, is_active, pin_code, default_organization_id')
      .in('phone', phoneCandidates);

    if (error || !matchedUsers || matchedUsers.length === 0) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const activeUsers = matchedUsers.filter((u) => Boolean(u.is_active));
    if (activeUsers.length === 0) {
      return NextResponse.json({ error: 'Аккаунт отключён' }, { status: 403 });
    }

    const adminUsers = activeUsers.filter((u) => {
      const uRoles = Array.isArray(u.roles) ? u.roles : [];
      return uRoles.includes('admin') || uRoles.includes('owner');
    });

    if (adminUsers.length === 0) {
      return NextResponse.json({ error: 'Нет доступа к панели управления' }, { status: 403 });
    }

    const adminUsersWithPin = adminUsers.filter((u) => Boolean(u.pin_code));
    if (adminUsersWithPin.length === 0) {
      return NextResponse.json(
        { error: 'ПИН-код не установлен — обратитесь к владельцу' },
        { status: 403 },
      );
    }

    let user: (typeof adminUsersWithPin)[number] | null = null;
    let pinCheck: { valid: boolean; needsRehash: boolean } = { valid: false, needsRehash: false };

    for (const candidate of adminUsersWithPin) {
      const check = verifyPin(String(pin), candidate.pin_code);
      if (check.valid) {
        user = candidate;
        pinCheck = check;
        break;
      }
    }

    if (!user || !pinCheck.valid) {
      return NextResponse.json({ error: 'Неверный ПИН-код' }, { status: 401 });
    }

    const roles = Array.isArray(user.roles) ? user.roles : [];

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

    const oid =
      (user as { default_organization_id?: string | null }).default_organization_id ||
      DEFAULT_ORGANIZATION_ID;
    const sessionToken = await signSessionToken({
      uid: user.id,
      roles,
      oid,
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
