/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PAYROLL_CATEGORIES: Record<string, string> = {
  driver: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
  loader: '18792fa8-fda8-472d-8e04-e19d2c6c053c',
  mechanic: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  mechanic_lead: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
};
const OTHER_EXPENSE = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30';

/**
 * POST /api/staff/pay-salary
 * Ручная выплата ЗП — создаёт expense approved+completed транзакцию.
 * Используется для владельца и администратора у которых нет pending PAYROLL.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    let adminId = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (!adminId) {
      const cookieStore = await cookies();
      adminId = cookieStore.get('salda_auth_token')?.value ?? null;
    }

    const supabase = createAdminClient();

    if (!adminId) {
      const { data: adminUser } = await (supabase.from('users') as any)
        .select('id')
        .filter('roles', 'cs', '{"admin"}')
        .limit(1)
        .single();
      adminId = adminUser?.id ?? null;
    }

    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      user_id: string;
      amount: string;
      from_wallet_id: string;
      note?: string;
    };

    if (!body.user_id || !body.amount || !body.from_wallet_id) {
      return NextResponse.json(
        { error: 'user_id, amount, from_wallet_id обязательны' },
        { status: 400 },
      );
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Некорректная сумма' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: user } = await (supabase.from('users') as any)
      .select('name, roles')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    const operationalRole = (user.roles as string[]).find((r) => r in PAYROLL_CATEGORIES);
    const categoryId = operationalRole ? PAYROLL_CATEGORIES[operationalRole] : OTHER_EXPENSE;

    const description =
      body.note?.trim() ||
      `ЗП: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const { data, error } = await (supabase.from('transactions') as any)
      .insert({
        direction: 'expense',
        category_id: categoryId,
        amount: amount.toFixed(2),
        description,
        lifecycle_status: 'approved',
        settlement_status: 'completed',
        related_user_id: body.user_id,
        from_wallet_id: body.from_wallet_id,
        created_by: adminId,
        idempotency_key: crypto.randomUUID(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
