/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BillingDocsPayload {
  waybill_type?: 'paper' | 'etrn'; // Либо бумага (ТрН), либо ЭТрН (строго одно из двух!)
  invoice_issued?: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
  tn_driver_delivered?: boolean;
  etrn_signed_edo?: boolean;
  epe_received_edo?: boolean;
  epe_number?: string | null;
  docs_sent_edo?: boolean;
  docs_sent_at?: string | null;
  client_accepted_edo?: boolean;
  client_accepted_at?: string | null;
  status?: 'in_progress' | 'accepted';
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: BillingDocsPayload = await req.json();
    const supabase = createAdminClient();

    // 1. Получаем текущую заявку
    const { data: currentOrder, error: orderErr } = await (supabase.from('orders') as any)
      .select(
        'id, base_doc_number, order_number, active_trip_id, client_id, price_without_vat, raw_parser_payload',
      )
      .eq('id', id)
      .single();

    if (orderErr || !currentOrder) {
      return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
    }

    const currentPayload = currentOrder.raw_parser_payload || {};
    const existingDocs: BillingDocsPayload = currentPayload.billing_docs || {
      waybill_type: 'paper',
      invoice_issued: false,
      invoice_number: null,
      invoice_date: null,
      tn_driver_delivered: false,
      etrn_signed_edo: false,
      epe_received_edo: false,
      epe_number: null,
      docs_sent_edo: false,
      docs_sent_at: null,
      client_accepted_edo: false,
      client_accepted_at: null,
      status: 'in_progress',
    };

    const mergedDocs: BillingDocsPayload = {
      ...existingDocs,
      ...body,
      status: body.client_accepted_edo ? 'accepted' : 'in_progress',
      client_accepted_at: body.client_accepted_edo
        ? body.client_accepted_at || new Date().toISOString()
        : null,
    };

    // 2. Если поставлена 5-я галочка «Контрагент в ЭДО поставил В ОПЛАТУ (подписал)»
    // — обновляем запись в trip_orders (Дебиторка):
    // снимается «выставить счёт» и появляется номер счёта со статусом 'issued'
    if (mergedDocs.client_accepted_edo) {
      const finalInvoiceNumber =
        mergedDocs.invoice_number?.trim() ||
        currentOrder.base_doc_number ||
        `СЧ-${currentOrder.order_number}`;

      const finalInvoiceDate = mergedDocs.invoice_date || new Date().toISOString().slice(0, 10);

      // Ищем заказ в trip_orders: сначала по active_trip_id
      let tripOrderQuery = (supabase.from('trip_orders') as any).update({
        invoice_number: finalInvoiceNumber,
        invoice_date: finalInvoiceDate,
        invoice_status: 'issued',
        updated_at: new Date().toISOString(),
      });

      if (currentOrder.active_trip_id) {
        tripOrderQuery = tripOrderQuery.eq('trip_id', currentOrder.active_trip_id);
      } else if (currentOrder.client_id) {
        tripOrderQuery = tripOrderQuery.eq('counterparty_id', currentOrder.client_id);
      }

      const { error: tripOrderErr } = await tripOrderQuery;
      if (tripOrderErr) {
        console.warn('Не удалось обновить trip_orders при фиксации счёта:', tripOrderErr.message);
      }
    } else if (body.client_accepted_edo === false && existingDocs.client_accepted_edo) {
      // Если галочку случайно сняли — возвращаем в unbilled
      let rollbackQuery = (supabase.from('trip_orders') as any).update({
        invoice_number: null,
        invoice_date: null,
        invoice_status: 'unbilled',
        updated_at: new Date().toISOString(),
      });

      if (currentOrder.active_trip_id) {
        rollbackQuery = rollbackQuery.eq('trip_id', currentOrder.active_trip_id);
      } else if (currentOrder.client_id) {
        rollbackQuery = rollbackQuery.eq('counterparty_id', currentOrder.client_id);
      }

      await rollbackQuery;
    }

    // 3. Сохраняем обновленный payload в таблице orders
    const updatedPayload = {
      ...currentPayload,
      billing_docs: mergedDocs,
    };

    const { error: updateErr } = await (supabase.from('orders') as any)
      .update({
        raw_parser_payload: updatedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, billing_docs: mergedDocs });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Ошибка сервера' }, { status: 500 });
  }
}
