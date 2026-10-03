/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const PAYROLL_CATEGORIES: Record<string, string> = {
  driver: 'd79213ee-3bc6-4433-b58a-ca7ea1040d00',
  loader: '18792fa8-fda8-472d-8e04-e19d2c6c053c',
  mechanic: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  mechanic_lead: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  welder: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  painter: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  electrician: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
  handyman: '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6',
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
      amount?: string;
      from_wallet_id?: string;
      wallet_splits?: Array<{ wallet_id: string; amount: number | string }>;
      note?: string;
    };

    if (!body.user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 });
    }

    let totalAmount = parseFloat(body.amount ?? '0');
    let splits: Array<{ wallet_id: string; amount: number }> = [];

    if (Array.isArray(body.wallet_splits) && body.wallet_splits.length > 0) {
      splits = body.wallet_splits
        .map((s) => ({
          wallet_id: String(s.wallet_id || '').trim(),
          amount: Math.round((parseFloat(String(s.amount)) || 0) * 100) / 100,
        }))
        .filter((s) => s.amount > 0 && s.wallet_id);

      const splitSum = Math.round(splits.reduce((acc, s) => acc + s.amount, 0) * 100) / 100;
      if (!totalAmount || isNaN(totalAmount) || totalAmount <= 0) {
        totalAmount = splitSum;
      } else if (Math.abs(splitSum - totalAmount) > 0.05) {
        return NextResponse.json(
          {
            error: `Сумма по кошелькам (${splitSum.toFixed(2)} ₽) не совпадает с суммой выплаты (${totalAmount.toFixed(2)} ₽)`,
          },
          { status: 400 },
        );
      }
    } else if (body.from_wallet_id && totalAmount > 0) {
      splits = [{ wallet_id: body.from_wallet_id, amount: totalAmount }];
    }

    if (isNaN(totalAmount) || totalAmount <= 0 || splits.length === 0) {
      return NextResponse.json(
        { error: 'Укажите корректную сумму и источник списания (кошелёк)' },
        { status: 400 },
      );
    }

    const { data: user } = await (supabase.from('users') as any)
      .select('name, roles')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    const operationalRole = (user.roles as string[]).find((r) => r in PAYROLL_CATEGORIES);
    const categoryId = operationalRole ? PAYROLL_CATEGORIES[operationalRole] : OTHER_EXPENSE;

    const baseDescription =
      body.note?.trim() ||
      `ЗП: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const WALLET_LABELS: Record<string, string> = {
      '10000000-0000-0000-0000-000000000001': 'Р/С',
      '10000000-0000-0000-0000-000000000002': 'Касса (Наличные)',
      '10000000-0000-0000-0000-000000000003': 'Карта',
    };

    const baseIdemp = crypto.randomUUID();
    const createdTransactions = [];

    for (let i = 0; i < splits.length; i++) {
      const s = splits[i]!;
      const wLabel = WALLET_LABELS[s.wallet_id] || `Кошелёк ${i + 1}`;
      const desc =
        splits.length > 1
          ? `${baseDescription} (${wLabel}: ${s.amount.toFixed(2)} ₽)`
          : baseDescription;
      const idempKey = splits.length > 1 ? `${baseIdemp}_split_${s.wallet_id}` : baseIdemp;

      const { data, error } = await (supabase.from('transactions') as any)
        .insert({
          direction: 'expense',
          category_id: categoryId,
          amount: s.amount.toFixed(2),
          description: desc,
          lifecycle_status: 'approved',
          settlement_status: 'completed',
          related_user_id: body.user_id,
          from_wallet_id: s.wallet_id,
          created_by: adminId,
          idempotency_key: idempKey,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      createdTransactions.push(data);
    }

    return NextResponse.json(
      splits.length === 1
        ? createdTransactions[0]
        : { ok: true, transactions: createdTransactions },
      { status: 201 },
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
