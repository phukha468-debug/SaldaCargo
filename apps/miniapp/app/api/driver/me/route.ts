import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_MINIAPP } from '@saldacargo/shared/session';
import { getVerifiedMiniappUserId } from '@/lib/auth/server';

export async function GET() {
  const userId = await getVerifiedMiniappUserId();

  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user || !user.is_active) {
      const response = NextResponse.json({ error: 'User not found' }, { status: 401 });
      response.cookies.delete(SESSION_COOKIE_MINIAPP);
      response.cookies.delete('salda_user_id');
      return response;
    }

    const { pin_code: _pinCode, ...safeUser } = user;
    void _pinCode;

    return NextResponse.json(safeUser, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[API /me] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
