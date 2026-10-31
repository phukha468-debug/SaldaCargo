/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/driver/loaders — список грузчиков */
export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, phone, notes')
      .filter('roles', 'cs', '{"loader"}')
      .eq('is_active', true)
      .not('name', 'ilike', '%STRESS%')
      .not('name', 'ilike', '%TEST%')
      .order('name');

    if (error) {
      console.error('[API Loaders] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const loaders = (data || []).map((u: any) => {
      let isOnline = false;
      let address = '';
      let hasTransport = false;
      let updatedAt = 0;

      if (u.notes) {
        try {
          const parsed = JSON.parse(u.notes);
          if (typeof parsed === 'object' && parsed !== null) {
            isOnline = Boolean(parsed.online);
            address = String(parsed.address || '');
            hasTransport = Boolean(parsed.car);
            updatedAt = Number(parsed.updatedAt || 0);
          }
        } catch {
          // notes is not JSON
        }
      }

      return {
        id: u.id,
        name: u.name,
        phone: u.phone,
        notes: u.notes,
        is_online: isOnline,
        address: address || 'Верхняя Салда',
        has_transport: hasTransport,
        updated_at: updatedAt,
      };
    });

    // Сортировка: сначала те, кто «На линии» (онлайн), затем по имени
    loaders.sort((a, b) => {
      if (a.is_online !== b.is_online) {
        return a.is_online ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ru');
    });

    return NextResponse.json(loaders);
  } catch (err: any) {
    console.error('[API Loaders] Fatal Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
