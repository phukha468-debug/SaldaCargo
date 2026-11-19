/* eslint-disable @typescript-eslint/no-explicit-any */
import { isStrictDocCounterparty, resolveKnownMasterCounterpartyId } from '@saldacargo/shared';

/**
 * Синхронизирует заказы рейса со статусом сбора документов (docs_collection) в таблице orders.
 *
 * Железное правило: если рейс утверждён (approved) и в нём есть заказы контрагентов со строгим
 * сбором документов (Геостройиндустрия, ПАО «Корпорация ВСМПО-АВИСМА», ООО АВИСМА),
 * то для КАЖДОГО такого заказа ОБЯЗАТЕЛЬНО должна существовать заявка в таблице orders
 * со статусом 'docs_collection' (если документы ещё не приняты клиентом в ЭДО).
 */
export async function syncStrictOrdersForTrip(supabase: any, tripId: string) {
  try {
    const { data: trip, error: tripErr } = await (supabase.from('trips') as any)
      .select(
        `
        id, trip_number, lifecycle_status, started_at, ended_at, asset_id, driver_id,
        asset:assets(id, reg_number, short_name),
        driver:users!trips_driver_id_fkey(id, name),
        trip_orders(
          id, counterparty_id, amount, payment_method, settlement_status, lifecycle_status, description,
          invoice_number, invoice_date, invoice_status,
          counterparty:counterparties(id, name, is_legal_entity)
        )
      `,
      )
      .eq('id', tripId)
      .maybeSingle();

    if (tripErr || !trip || trip.lifecycle_status !== 'approved') return;

    const validTripOrders = ((trip.trip_orders as any[]) || []).filter(
      (to: any) =>
        to.lifecycle_status !== 'cancelled' &&
        to.counterparty_id &&
        isStrictDocCounterparty(to.counterparty?.name),
    );

    if (validTripOrders.length === 0) return;

    const { data: existingOrders, error: ordersErr } = await (supabase.from('orders') as any)
      .select('*')
      .eq('active_trip_id', tripId);

    if (ordersErr) {
      console.warn('Ошибка выборки существующих заявок для рейса:', ordersErr.message);
      return;
    }

    const assignedOrderIds = new Set<string>();

    for (const to of validTripOrders) {
      const cpName = to.counterparty?.name || '';
      const cpId = resolveKnownMasterCounterpartyId(cpName) || to.counterparty_id;

      // Ищем привязанную заявку:
      // 1. По точному trip_order_id в raw_parser_payload
      let match = (existingOrders || []).find(
        (o: any) => !assignedOrderIds.has(o.id) && o.raw_parser_payload?.trip_order_id === to.id,
      );

      // 2. Либо по совпадению client_id
      if (!match) {
        match = (existingOrders || []).find(
          (o: any) =>
            !assignedOrderIds.has(o.id) &&
            !o.raw_parser_payload?.trip_order_id &&
            o.client_id === cpId,
        );
      }

      // 3. Либо по текстовому совпадению в loading_org_name, если client_id был null
      if (!match) {
        match = (existingOrders || []).find(
          (o: any) =>
            !assignedOrderIds.has(o.id) &&
            !o.raw_parser_payload?.trip_order_id &&
            !o.client_id &&
            o.loading_org_name &&
            isStrictDocCounterparty(o.loading_org_name) &&
            (o.loading_org_name.toLowerCase().includes('геострой') ===
              cpName.toLowerCase().includes('геострой') ||
              o.loading_org_name.toLowerCase().includes('всмпо') ===
                cpName.toLowerCase().includes('всмпо') ||
              o.loading_org_name.toLowerCase().includes('ависма') ===
                cpName.toLowerCase().includes('ависма')),
        );
      }

      if (match) {
        assignedOrderIds.add(match.id);
        const payload = match.raw_parser_payload || {};
        const billingDocs = payload.billing_docs || {};
        const isAccepted = Boolean(
          billingDocs.client_accepted_edo || billingDocs.status === 'accepted',
        );

        const updatedPayload = {
          ...payload,
          trip_order_id: to.id,
          billing_docs: {
            waybill_type: billingDocs.waybill_type || 'paper',
            status: isAccepted ? 'accepted' : 'in_progress',
            invoice_issued: Boolean(to.invoice_number || billingDocs.invoice_issued),
            invoice_number: to.invoice_number || billingDocs.invoice_number || null,
            invoice_date: to.invoice_date || billingDocs.invoice_date || null,
            tn_driver_delivered: Boolean(billingDocs.tn_driver_delivered),
            etrn_signed_edo: Boolean(billingDocs.etrn_signed_edo),
            epe_received_edo: Boolean(billingDocs.epe_received_edo),
            docs_sent_edo: Boolean(billingDocs.docs_sent_edo),
            client_accepted_edo: isAccepted,
          },
        };

        await (supabase.from('orders') as any)
          .update({
            client_id: cpId,
            status: isAccepted ? 'completed' : 'docs_collection',
            price_without_vat: Number(to.amount) || match.price_without_vat,
            assigned_vehicle_id: trip.asset_id || match.assigned_vehicle_id,
            assigned_driver_id: trip.driver_id || match.assigned_driver_id,
            raw_parser_payload: updatedPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id);
      } else {
        // Создаем новую заявку под этот заказ рейса со статусом 'docs_collection'
        const finalDocNumber = String(trip.trip_number || 'б/н');
        const tripDate = trip.started_at
          ? trip.started_at.slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const newOrderPayload: any = {
          source_type: 'direct_ad',
          status: 'docs_collection',
          base_doc_name: 'Поручение экспедитору',
          base_doc_number: finalDocNumber,
          base_doc_date: tripDate,
          internal_order_number: finalDocNumber,
          client_id: cpId,
          shipper_id: cpId,
          consignee_id: cpId,
          cargo_name: to.description || 'Металлопрокат / продукция',
          cargo_condition: 'без повреждений',
          packaging_type: 'паллеты',
          package_code: '00',
          places_count: 1,
          weight_gross_kg: 0,
          weight_net_kg: 0,
          cargo_declared_value: 0,
          loading_address_json: {},
          unloading_address_json: {},
          price_without_vat: Number(to.amount) || 0,
          vat_rate: 'без НДС',
          payment_terms: 'Безналичный расчет (Дебиторская задолженность)',
          assigned_vehicle_id: trip.asset_id || null,
          assigned_driver_id: trip.driver_id || null,
          active_trip_id: trip.id,
          raw_parser_payload: {
            trip_order_id: to.id,
            billing_docs: {
              waybill_type: 'paper',
              status: 'in_progress',
              invoice_issued: Boolean(to.invoice_number),
              invoice_number: to.invoice_number || null,
              invoice_date: to.invoice_date || null,
              tn_driver_delivered: false,
              etrn_signed_edo: false,
              epe_received_edo: false,
              docs_sent_edo: false,
              client_accepted_edo: false,
            },
          },
        };

        const { data: inserted, error: insertErr } = await (supabase.from('orders') as any)
          .insert(newOrderPayload)
          .select('id')
          .single();

        if (inserted?.id) {
          assignedOrderIds.add(inserted.id);
        } else if (insertErr) {
          console.warn('Ошибка создания заявки docs_collection для рейса:', insertErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error('Ошибка в syncStrictOrdersForTrip:', err?.message || err);
  }
}
