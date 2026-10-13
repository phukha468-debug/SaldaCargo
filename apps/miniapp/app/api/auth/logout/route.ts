import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = await createClient();

  // 1. Выход из Supabase Auth
  await supabase.auth.signOut();

  // 2. Очистка куки сессии salda_user_id
  const cookieStore = await cookies();
  cookieStore.delete('salda_user_id');
  cookieStore.set('salda_user_id', '', {
    path: '/',
    expires: new Date(0),
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  return NextResponse.json({ success: true });
}
