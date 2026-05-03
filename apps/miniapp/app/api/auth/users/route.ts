import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  if (!role) {
    return NextResponse.json({ error: 'Role is required' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    
    // Маппинг UI-ролей на DB-роли
    const roleMapping: Record<string, string[]> = {
      driver: ['driver'],
      mechanic: ['mechanic', 'mechanic_lead'],
      admin: ['admin', 'owner'],
    };

    const targetRoles = roleMapping[role as string] || [role as string];

    // Ищем пользователей, у которых есть хотя бы одна из целевых ролей
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, roles')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('[API Auth Users] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const usersData = (users || []) as any[];

    const filteredUsers = usersData.filter(u => 
      u.roles && (u.roles as string[]).some((r: string) => targetRoles.includes(r))
    );

    return NextResponse.json(filteredUsers);
  } catch (err: any) {
    console.error('[API Auth Users] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
