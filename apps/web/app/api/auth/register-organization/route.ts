import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  SESSION_COOKIE_WEB,
  checkRateLimit,
  getClientIp,
  getOrgRegistrationInviteCode,
  signSessionToken,
  verifyOrgRegistrationInviteCode,
} from '@saldacargo/shared';
import {
  OnboardingError,
  ProvisionOrganizationSchema,
  provisionNewOrganization,
} from '@saldacargo/domain-service';
import { createAdminClient } from '@/lib/supabase/admin';

const REGISTER_RATE_LIMIT = { limit: 5, windowMs: 30 * 60 * 1000 }; // 5 попыток за 30 минут

const registerBodySchema = ProvisionOrganizationSchema.extend({
  invite_code: z.string().trim().min(1, 'Введите инвайт-код приглашения'),
});

/**
 * GET /api/auth/register-organization
 * Возвращает флаг доступности Private Beta регистрации (не раскрывая сам инвайт-код).
 */
export async function GET() {
  return NextResponse.json({
    enabled: Boolean(getOrgRegistrationInviteCode()),
    mode: 'private_beta',
  });
}

/**
 * POST /api/auth/register-organization
 * Создаёт новую организацию (тенанта) в режиме Private Beta по инвайт-коду ORG_REGISTRATION_INVITE_CODE.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rl = checkRateLimit(`org-register:${ip}`, REGISTER_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Слишком много попыток регистрации. Попробуйте позже.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSeconds) },
        },
      );
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
    }

    // 1. Сначала проверяем Private Beta инвайт-код
    const inviteCheck = verifyOrgRegistrationInviteCode(
      (rawBody as Record<string, unknown>).invite_code as string | undefined,
    );
    if (!inviteCheck.allowed) {
      if (inviteCheck.reason === 'REGISTRATION_CLOSED') {
        return NextResponse.json(
          {
            error: 'Регистрация новых компаний сейчас закрыта (Private Beta).',
            code: 'REGISTRATION_CLOSED',
          },
          { status: 403 },
        );
      }
      return NextResponse.json(
        {
          error: 'Неверный инвайт-код приглашения.',
          code: 'INVALID_INVITE_CODE',
        },
        { status: 403 },
      );
    }

    // 2. Валидируем данные компании и владельца
    const parsed = registerBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => i.message).join('; ');
      return NextResponse.json({ error: details, code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const { invite_code: _unusedInvite, ...provisionInput } = parsed.data;
    void _unusedInvite;

    const supabase = createAdminClient();
    const result = await provisionNewOrganization(supabase, provisionInput);

    // 3. Авторизуем созданного владельца в новой организации
    const sessionToken = await signSessionToken({
      uid: result.user.id,
      roles: result.user.roles,
      oid: result.organization.id,
      ttlSeconds: 60 * 60 * 24 * 7,
    });

    const response = NextResponse.json(
      {
        success: true,
        organization: result.organization,
        legal_entity: result.legalEntity,
      },
      { status: 201 },
    );

    response.cookies.set(SESSION_COOKIE_WEB, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (err) {
    if (err instanceof OnboardingError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    return NextResponse.json(
      { error: 'Внутренняя ошибка при регистрации компании' },
      { status: 500 },
    );
  }
}
