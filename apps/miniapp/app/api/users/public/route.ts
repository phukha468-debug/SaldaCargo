/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/**
 * GET /api/users/public
 * Возвращает список активных пользователей для упрощенного входа.
 * Использует Admin Client для обхода RLS.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');

    const supabase = createAdminClient();

    let query = supabase.from('users').select('id, name, roles, pin_code').order('name');

    const { data: users, error } = await query;

    if (error) {
      console.error('[API Users Public] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const usersData = (users || []) as any[];

    // Фильтруем по роли на стороне сервера, так как roles - это JSONB/Array
    let filteredUsers = usersData;
    if (role) {
      filteredUsers = filteredUsers.filter(
        (u) => u.roles && Array.isArray(u.roles) && u.roles.includes(role),
      );
    }

    // Expose has_pin flag (not the pin itself)
    const safeUsers = filteredUsers.map(({ pin_code, ...u }: any) => ({
      ...u,
      has_pin: Boolean(pin_code),
    }));

    return NextResponse.json(safeUsers);
  } catch (err: any) {
    console.error('[API Users Public] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
