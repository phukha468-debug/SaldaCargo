import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  DEFAULT_ORGANIZATION_ID,
  SESSION_COOKIE_MINIAPP,
  signSessionToken,
  hashPin,
  verifyPin,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';
import { getMiniappCookieOptions, requireRole } from '@/lib/auth/server';

const SET_PIN_RATE_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

/** POST /api/auth/set-pin — устанавливает или меняет 4-значный PIN сотрудника (хранится как scrypt-хэш) */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      user_id?: string;
      pin?: string;
      current_pin?: string;
    };
    const { user_id, pin, current_pin } = body;

    if (!user_id || !pin) {
      return NextResponse.json({ error: 'Не указан пользователь или PIN-код' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rl = checkRateLimit(`miniapp-setpin:${ip}:${user_id}`, SET_PIN_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток смены PIN. Попробуйте позже.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSeconds) },
        },
      );
    }

    const cleanPin = String(pin).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return NextResponse.json(
        { error: 'PIN-код должен состоять ровно из 4 цифр' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('id, name, roles, is_active, pin_code, default_organization_id')
      .eq('id', user_id)
      .maybeSingle();

    if (findError || !user) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Сотрудник деактивирован' }, { status: 403 });
    }

    const targetRoles = Array.isArray(user.roles) ? user.roles : [];
    const targetIsAdmin = targetRoles.includes('admin') || targetRoles.includes('owner');

    // Проверяем, является ли вызывающий авторизованным админом/владельцем
    const adminCheck = await requireRole(['admin', 'owner']);
    const callerIsAdmin = !(adminCheck instanceof NextResponse);

    if (user.pin_code) {
      // PIN уже установлен: смена допустима только при верном current_pin ИЛИ от имени admin/owner
      if (!callerIsAdmin) {
        if (!current_pin) {
          return NextResponse.json(
            { error: 'Для смены PIN-кода требуется указать текущий PIN' },
            { status: 403 },
          );
        }
        const currentCheck = verifyPin(String(current_pin), user.pin_code);
        if (!currentCheck.valid) {
          return NextResponse.json(
            { error: 'Неверный текущий PIN-код для смены' },
            { status: 403 },
          );
        }
      }
    } else if (targetIsAdmin && !callerIsAdmin) {
      // Первичная установка PIN для админа/владельца без админ-сессии запрещена
      return NextResponse.json(
        { error: 'Первичная установка PIN администратора выполняется через владельца' },
        { status: 403 },
      );
    }

    const hashed = hashPin(cleanPin);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        pin_code: hashed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // При первичной установке PIN самим сотрудником сразу выдаём подписанную сессию
    if (!user.pin_code && !callerIsAdmin) {
      const oid =
        (user as { default_organization_id?: string | null }).default_organization_id ||
        DEFAULT_ORGANIZATION_ID;
      const token = await signSessionToken({
        uid: user.id,
        roles: targetRoles,
        oid,
        ttlSeconds: 60 * 60 * 24 * 30,
      });
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_MINIAPP, token, getMiniappCookieOptions(60 * 60 * 24 * 30));
    }

    return NextResponse.json({ ok: true, message: 'PIN-код успешно установлен' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
