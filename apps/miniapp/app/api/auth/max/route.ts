import * as crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_MINIAPP,
  signSessionToken,
  getMaxBotEnv,
  checkRateLimit,
  getClientIp,
} from '@saldacargo/shared';
import { getMiniappCookieOptions } from '@/lib/auth/server';

const MAX_AUTH_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 };
const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24; // 24 часа

/**
 * Верифицирует строку initData из MAX Mini App SDK по HMAC-SHA256:
 * secret_key = HMAC_SHA256("WebAppData", botToken)
 * expected_hash = HMAC_SHA256(secret_key, sorted_data_check_string)
 */
function verifyMaxInitDataRaw(
  rawInitData: string,
  botToken: string,
): {
  valid: boolean;
  maxUserId: string | null;
} {
  try {
    const params = new URLSearchParams(rawInitData);
    const receivedHash = params.get('hash');
    if (!receivedHash) return { valid: false, maxUserId: null };

    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      const authDate = parseInt(authDateStr, 10);
      const nowSec = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(authDate) || nowSec - authDate > MAX_INIT_DATA_AGE_SECONDS) {
        return { valid: false, maxUserId: null };
      }
    }

    const pairs: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        pairs.push(`${key}=${value}`);
      }
    });
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const computedBuf = Buffer.from(computedHash, 'hex');
    const receivedBuf = Buffer.from(receivedHash, 'hex');
    if (computedBuf.length !== receivedBuf.length) {
      return { valid: false, maxUserId: null };
    }
    if (!crypto.timingSafeEqual(computedBuf, receivedBuf)) {
      return { valid: false, maxUserId: null };
    }

    const userJson = params.get('user');
    if (userJson) {
      const parsedUser = JSON.parse(userJson) as { id?: string | number };
      if (parsedUser.id !== undefined && parsedUser.id !== null) {
        return { valid: true, maxUserId: String(parsedUser.id) };
      }
    }

    const directId = params.get('max_user_id');
    return { valid: true, maxUserId: directId };
  } catch {
    return { valid: false, maxUserId: null };
  }
}

/**
 * POST /api/auth/max
 * Авторизация через МАХ Mini App с обязательной криптографической проверкой подписи initData.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`miniapp-max:${ip}`, MAX_AUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Слишком много попыток входа. Попробуйте позже.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const botToken = getMaxBotEnv()?.token;
  if (!botToken) {
    return NextResponse.json(
      { error: 'Интеграция MAX Bot не настроена (отсутствует MAX_BOT_TOKEN)' },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    initDataRaw?: string;
    initData?: string | { raw?: string };
  };

  const rawInitData =
    typeof body.initDataRaw === 'string'
      ? body.initDataRaw
      : typeof body.initData === 'string'
        ? body.initData
        : typeof body.initData?.raw === 'string'
          ? body.initData.raw
          : '';

  if (!rawInitData) {
    return NextResponse.json(
      { error: 'Требуется подписанная строка initData от MAX SDK' },
      { status: 401 },
    );
  }

  const verified = verifyMaxInitDataRaw(rawInitData, botToken);
  if (!verified.valid || !verified.maxUserId) {
    return NextResponse.json(
      { error: 'Невалидная или просроченная подпись MAX SDK' },
      { status: 401 },
    );
  }

  const maxUserId = verified.maxUserId;
  const supabaseAdmin = createAdminClient();
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, name, roles, is_active')
    .eq('max_user_id', maxUserId)
    .single();

  if (error || !user) {
    return NextResponse.json(
      { error: `Доступ запрещён. Ваш MAX ID: ${maxUserId}. Сообщите его администратору.` },
      { status: 403 },
    );
  }

  if (!user.is_active) {
    return NextResponse.json(
      { error: 'Аккаунт деактивирован. Обратитесь к администратору.' },
      { status: 403 },
    );
  }

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const token = await signSessionToken({
    uid: user.id,
    roles,
    ttlSeconds: 60 * 60 * 24 * 30,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      roles,
    },
  });
  response.cookies.set(SESSION_COOKIE_MINIAPP, token, getMiniappCookieOptions(60 * 60 * 24 * 30));

  return response;
}
