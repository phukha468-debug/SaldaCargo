import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const supabase = await createClient();
  
  // 1. Выход из Supabase Auth
  await supabase.auth.signOut();
  
  // 2. Очистка куки сессии salda_user_id
  const cookieStore = await cookies();
  cookieStore.set('salda_user_id', '', {
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });

  return NextResponse.json({ success: true });
}
