import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** POST /api/auth/session — устанавливает серверную куку сессии salda_user_id */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { user_id?: string };
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    cookieStore.set('salda_user_id', user_id, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 дней
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /auth/session] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/** DELETE /api/auth/session — удаляет куку сессии */
export async function DELETE() {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieStore = await cookies();
    cookieStore.delete('salda_user_id');
    cookieStore.set('salda_user_id', '', {
      path: '/',
      expires: new Date(0),
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[API /auth/session] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
