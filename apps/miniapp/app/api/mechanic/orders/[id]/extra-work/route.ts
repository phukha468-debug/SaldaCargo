/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { getVerifiedMiniappSession } from '@/lib/auth/server';
import { DEFAULT_ORGANIZATION_ID } from '@saldacargo/shared';
import { NextResponse } from 'next/server';

/**
 * POST /api/mechanic/orders/:id/extra-work
 * Механик обнаружил доп. работу в процессе — запрашивает согласование у Администратора.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params;
  const session = await getVerifiedMiniappSession();
  if (!session?.uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const organizationId = session.oid || DEFAULT_ORGANIZATION_ID;

  const body = await request.json();
  const { work_catalog_id, custom_work_name, mechanic_note } = body as {
    work_catalog_id?: string;
    custom_work_name?: string;
    mechanic_note: string;
  };

  if (!work_catalog_id && !custom_work_name) {
    return NextResponse.json(
      { error: 'work_catalog_id или custom_work_name обязательны' },
      { status: 400 },
    );
  }
  if (!mechanic_note?.trim()) {
    return NextResponse.json(
      { error: 'mechanic_note обязателен — объясни что обнаружил' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await (supabase.from('service_order_works') as any)
    .insert({
      organization_id: organizationId,
      service_order_id: orderId,
      work_catalog_id: work_catalog_id ?? null,
      custom_work_name: custom_work_name ?? null,
      norm_minutes: 0,
      actual_minutes: 0,
      price_client: 0,
      status: 'pending',
      requires_admin_review: true,
      extra_work_status: 'pending_approval',
      extra_work_mechanic_note: mechanic_note.trim(),
    })
    .select(
      'id, extra_work_status, custom_work_name, norm_minutes, extra_work_mechanic_note, work:work_catalog(name)',
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
