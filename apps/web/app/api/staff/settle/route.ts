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
const FALLBACK_CATEGORY = 'df1022df-4ea6-46fc-b9aa-f3c9eb4e7f30'; // OTHER_EXPENSE

async function resolveUserId(supabase: any): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get('salda_user_id')?.value;
  if (fromCookie) return fromCookie;
  const { data } = await (supabase.from('users') as any)
    .select('id')
    .overlaps('roles', ['owner', 'admin'])
    .limit(1)
    .single();
  return data?.id ?? '00000000-0000-0000-0000-000000000000';
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();
    const adminId = await resolveUserId(supabase);

    const body = (await request.json()) as {
      user_id: string;
      amount: string;
      from_wallet_id: string;
      description?: string;
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

    // Определяем категорию ЗП по роли сотрудника
    const { data: user } = await (supabase as any)
      .from('users')
      .select('name, roles')
      .eq('id', body.user_id)
      .single();

    if (!user) return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 });

    const operationalRole = (user.roles as string[]).find((r) => r in PAYROLL_CATEGORIES);
    const categoryId = operationalRole ? PAYROLL_CATEGORIES[operationalRole] : FALLBACK_CATEGORY;

    const description =
      body.description?.trim() ||
      `ЗП: ${user.name} — ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    const { data, error } = await (supabase as any)
      .from('transactions')
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
