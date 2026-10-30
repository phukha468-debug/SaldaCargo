import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();
    const userId =
      searchParams.get('user_id') ||
      request.headers.get('x-salda-user-id') ||
      cookieStore.get('salda_user_id')?.value;

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, notes')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    let shift = { online: false, address: '', car: false, updatedAt: 0 };
    if (user.notes) {
      try {
        const parsed = JSON.parse(user.notes);
        if (typeof parsed === 'object' && parsed !== null) {
          shift = {
            online: Boolean(parsed.online),
            address: String(parsed.address || ''),
            car: Boolean(parsed.car),
            updatedAt: Number(parsed.updatedAt || 0),
          };
        }
      } catch {
        // notes is not JSON
      }
    }

    return NextResponse.json({ ok: true, shift });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const userId =
      body.user_id ||
      request.headers.get('x-salda-user-id') ||
      cookieStore.get('salda_user_id')?.value;

    const { is_online, address, has_transport } = body;

    if (!userId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const shiftData = {
      online: Boolean(is_online),
      address: String(address || '').trim(),
      car: Boolean(has_transport),
      updatedAt: Date.now(),
    };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('users')
      .update({
        notes: JSON.stringify(shiftData),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, shift: shiftData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
