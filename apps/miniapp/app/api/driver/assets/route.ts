/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** GET /api/driver/assets — список активных машин для dropdown */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const customUserId = cookieStore.get('salda_user_id')?.value;

    const supabase = createAdminClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    console.log(`[API Assets] Connecting to: ${supabaseUrl}`);

    // Проверяем права пользователя: администратор или доверенные лица для ПРР
    let isPrrAdmin = false;
    if (customUserId) {
      const { data: user } = await (supabase.from('users') as any)
        .select('name, roles')
        .eq('id', customUserId)
        .maybeSingle();

      if (user) {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        const isAdmin = roles.includes('admin') || roles.includes('owner');
        const isWhitelisted = Boolean(
          user.name && /Нигамед|Шахмаев|Роман.*Радик|Радикович/i.test(user.name),
        );
        isPrrAdmin = isAdmin || isWhitelisted;
      }
    }

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .not('status', 'in', '("sold","written_off")')
      .not('short_name', 'ilike', '%STRESS%')
      .not('short_name', 'ilike', '%TEST%')
      .order('short_name');

    if (error) {
      console.error('[API Assets] DB Error:', error);
      return NextResponse.json([
        { id: 'err', short_name: 'ОШИБКА БД: ' + error.message, reg_number: 'ERR' },
      ]);
    }

    if (!data || data.length === 0) {
      console.log('[API Assets] DB IS EMPTY');
      return NextResponse.json([
        { id: 'empty', short_name: 'БАЗА ПУСТА (0 строк)', reg_number: 'EMPTY' },
      ]);
    }

    // Если водитель не является администратором — скрываем виртуальный объект "БЕЗ АВТО"
    const filtered = data.filter((a: any) => {
      const isPrr = a.reg_number === 'БЕЗ АВТО' || a.short_name?.toLowerCase().includes('без авто');
      if (isPrr) {
        return isPrrAdmin;
      }
      return true;
    });

    console.log(`[API Assets] Returning ${filtered.length} rows (isPrrAdmin: ${isPrrAdmin})`);
    return NextResponse.json(filtered);
  } catch (err: any) {
    console.error('[API Assets] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
