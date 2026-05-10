/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('salda_user_id')?.value ?? null;
}

/** POST /api/driver/service-orders — водитель создаёт заявку на ремонт */
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await request.json()) as {
      asset_id: string;
      problem_description: string;
      priority?: string;
    };

    if (!body.asset_id?.trim()) {
      return NextResponse.json({ error: 'Выберите автомобиль' }, { status: 400 });
    }
    if (!body.problem_description?.trim()) {
      return NextResponse.json({ error: 'Опишите проблему' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('service_orders') as any)
      .insert({
        machine_type: 'own',
        asset_id: body.asset_id,
        problem_description: body.problem_description.trim(),
        priority: body.priority ?? 'normal',
        status: 'created',
        lifecycle_status: 'draft',
        created_by: userId,
      })
      .select('id, order_number')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** GET /api/driver/service-orders — свои заявки (для отображения статуса) */
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('service_orders') as any)
      .select(
        `
        id, order_number, status, lifecycle_status, priority, created_at,
        asset:assets(short_name, reg_number),
        problem_description
      `,
      )
      .eq('created_by', userId)
      .eq('machine_type', 'own')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
