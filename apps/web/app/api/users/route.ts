import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const supabase = await createClient();
  let query = supabase.from('users').select('id, name, roles').eq('is_active', true);

  if (role) {
    query = query.contains('roles', [role]);
  }

  const { data, error } = await query.order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

