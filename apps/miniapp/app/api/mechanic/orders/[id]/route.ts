/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getOrderDetail } from '@saldacargo/domain-service';
import { isOilOrFilterWork } from '@saldacargo/shared';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const supabase = createAdminClient();
    const order = await getOrderDetail(supabase, id);
    return NextResponse.json(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { status, odometer_end, odometer_start } = body as {
      status?: string;
      odometer_end?: number | string;
      odometer_start?: number | string;
    };

    const supabase = createAdminClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (status === 'completed') update.lifecycle_status = 'draft';

    if (odometer_end != null && !isNaN(Number(odometer_end))) {
      update.odometer_end = Number(odometer_end);
    }
    if (odometer_start != null && !isNaN(Number(odometer_start))) {
      update.odometer_start = Number(odometer_start);
    }

    if (status === 'completed') {
      const { data: ord } = await (supabase as any)
        .from('service_orders')
        .select(
          `id, asset_id, client_vehicle_id, odometer_start, odometer_end,
           works:service_order_works(custom_work_name, work_description, notes, work_catalog:work_catalog(name))`,
        )
        .eq('id', id)
        .single();

      if (ord) {
        const hasOil = (ord.works || []).some(
          (w: any) =>
            isOilOrFilterWork(w.work_catalog?.name) ||
            isOilOrFilterWork(w.custom_work_name) ||
            isOilOrFilterWork(w.work_description) ||
            isOilOrFilterWork(w.notes),
        );

        const curOdo =
          update.odometer_end != null
            ? Number(update.odometer_end)
            : update.odometer_start != null
              ? Number(update.odometer_start)
              : ord.odometer_end || ord.odometer_start || null;

        if (hasOil && (!curOdo || curOdo <= 0)) {
          return NextResponse.json(
            { error: 'При замене масла или фильтров необходимо указать текущий одометр!' },
            { status: 400 },
          );
        }

        if (curOdo && curOdo > 0 && ord.asset_id) {
          if (hasOil) {
            const { data: assetData } = await (supabase.from('assets') as any)
              .select('notes')
              .eq('id', ord.asset_id)
              .single();

            let docsObj: Record<string, any> = {};
            const existingNotes = assetData?.notes || '';
            const match = existingNotes.match(/\[DOCS_DATA:(.*?)\]/s);
            if (match && match[1]) {
              try {
                docsObj = JSON.parse(match[1]);
              } catch {}
            } else if (existingNotes.trim().startsWith('{') && existingNotes.trim().endsWith('}')) {
              try {
                docsObj = JSON.parse(existingNotes.trim());
              } catch {}
            }

            docsObj.oil_last_km = curOdo;
            docsObj.oil_last_date = new Date().toISOString().split('T')[0];

            const cleanUserNote = existingNotes.replace(/\[DOCS_DATA:.*?\]/s, '').trim();
            const updatedNotes = cleanUserNote
              ? `${cleanUserNote}\n[DOCS_DATA:${JSON.stringify(docsObj)}]`
              : `[DOCS_DATA:${JSON.stringify(docsObj)}]`;

            await (supabase as any)
              .from('assets')
              .update({
                odometer_current: curOdo,
                notes: updatedNotes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', ord.asset_id);
          } else {
            await (supabase as any)
              .from('assets')
              .update({ odometer_current: curOdo, updated_at: new Date().toISOString() })
              .eq('id', ord.asset_id);
          }
        }
      }
    }

    const { data, error } = await (supabase as any)
      .from('service_orders')
      .update(update)
      .eq('id', id)
      .select('id, status, odometer_end')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
