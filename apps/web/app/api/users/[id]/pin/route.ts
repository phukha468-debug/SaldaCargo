import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createWebApiHandler } from '@/lib/api';
import { decryptPin, isHashedPin, isUuid } from '@saldacargo/shared';

/**
 * GET /api/users/[id]/pin — расшифровка и просмотр PIN-кода сотрудника (только admin/owner).
 * Записывает факт просмотра в audit_log.
 */
export const GET = createWebApiHandler<undefined, Record<string, string>, { id: string }>(
  {
    routeName: 'GET /api/users/[id]/pin',
    roles: ['admin', 'owner'],
    rateLimit: { keyPrefix: 'reveal-pin', limit: 60, windowMs: 60_000 },
  },
  async ({ auth, params }) => {
    const targetUserId = params.id;
    if (!isUuid(targetUserId)) {
      return NextResponse.json({ error: 'Некорректный ID сотрудника' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Проверяем принадлежность сотрудника к текущей организации
    const { data: membership } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', auth.organizationId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, pin_code, pin_encrypted, default_organization_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });
    }

    const belongsToOrg =
      Boolean(membership) ||
      (user as { default_organization_id?: string | null }).default_organization_id ===
        auth.organizationId;

    if (!belongsToOrg) {
      return NextResponse.json({ error: 'Нет доступа к сотруднику' }, { status: 403 });
    }

    if (!user.pin_code) {
      return NextResponse.json({ pin: null, reason: 'not_set' });
    }

    let revealedPin: string | null = null;
    if (user.pin_encrypted) {
      revealedPin = decryptPin(user.pin_encrypted);
    } else if (!isHashedPin(user.pin_code)) {
      revealedPin = user.pin_code.trim();
    }

    if (!revealedPin) {
      return NextResponse.json({
        pin: null,
        reason: 'hashed_only',
        message: 'PIN захеширован до обновления — появится после входа сотрудника или смены PIN',
      });
    }

    // Фиксируем просмотр в audit_log (best-effort)
    try {
      await (
        supabase.from('audit_log') as unknown as {
          insert: (row: Record<string, unknown>) => Promise<unknown>;
        }
      ).insert({
        organization_id: auth.organizationId,
        user_id: auth.userId,
        action: 'reveal_user_pin',
        entity_type: 'user',
        entity_id: targetUserId,
        details: { target_name: user.name },
      });
    } catch {
      // Не блокируем ответ при сбое логирования
    }

    return NextResponse.json({ pin: revealedPin });
  },
);
