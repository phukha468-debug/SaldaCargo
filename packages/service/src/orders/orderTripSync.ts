/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  isStrictDocCounterparty,
  resolveKnownMasterCounterpartyId,
  type OrganizationSettings,
} from '@saldacargo/shared';

export interface SyncStrictOrdersOptions {
  organizationId?: string;
  orgSettings?: OrganizationSettings;
}

export interface SyncStrictOrdersResult {
  created: number;
  updated: number;
  cancelled: number;
}

/**
 * Синхронизирует заказы рейса со статусом сбора документов (docs_collection) в таблице orders.
 *
 * Единый источник истины для Web и MiniApp:
 * если рейс утверждён (approved) и в нём есть заказы контрагентов со строгим
 * сбором документов (ВСМПО, АВИСМА, Геостройиндустрия — или паттерны из orgSettings),
 * то для КАЖДОГО такого заказа ОБЯЗАТЕЛЬНО существует заявка в таблице orders
 * со статусом 'docs_collection' (если документы ещё не приняты клиентом в ЭДО).
 */
export async function syncStrictOrdersForTrip(
  supabase: any,
  tripId: string,
  options?: SyncStrictOrdersOptions,
): Promise<SyncStrictOrdersResult> {
  const result: SyncStrictOrdersResult = { created: 0, updated: 0, cancelled: 0 };

  try {
    let tripQuery = (supabase.from('trips') as any)
      .select(
        `
        id, organization_id, trip_number, lifecycle_status, started_at, ended_at, asset_id, driver_id,
        asset:assets(id, reg_number, short_name),
        driver:users!trips_driver_id_fkey(id, name),
        trip_orders(
          id, counterparty_id, amount, payment_method, settlement_status, lifecycle_status, description,
          invoice_number, invoice_date, invoice_status,
          counterparty:counterparties(id, name, is_legal_entity)
        )
      `,
      )
      .eq('id', tripId);

    if (options?.organizationId) {
      tripQuery = tripQuery.eq('organization_id', options.organizationId);
    }

    const { data: trip, error: tripErr } = await tripQuery.maybeSingle();

    if (tripErr || !trip || trip.lifecycle_status !== 'approved') return result;

    const orgId: string | undefined = trip.organization_id || options?.organizationId;

    const validTripOrders = ((trip.trip_orders as any[]) || []).filter(
      (to: any) =>
        to.lifecycle_status !== 'cancelled' &&
        to.counterparty_id &&
        isStrictDocCounterparty(to.counterparty?.name, options?.orgSettings),
    );

    let existingQuery = (supabase.from('orders') as any).select('*').eq('active_trip_id', tripId);
    if (orgId) {
      existingQuery = existingQuery.eq('organization_id', orgId);
    }

    const { data: existingOrders, error: ordersErr } = await existingQuery;

    if (ordersErr) {
      console.error('Ошибка выборки существующих заявок для рейса:', ordersErr.message);
      return result;
    }

    const assignedOrderIds = new Set<string>();
    const validTripOrderIds = new Set<string>(validTripOrders.map((to: any) => to.id));

    for (const to of validTripOrders) {
      const cpName = to.counterparty?.name || '';
      const cpId = resolveKnownMasterCounterpartyId(cpName) || to.counterparty_id;

      // Ищем привязанную заявку:
      // 1. По точному trip_order_id в raw_parser_payload
      let match = (existingOrders || []).find(
        (o: any) =>
          o.status !== 'cancelled' &&
          !assignedOrderIds.has(o.id) &&
          o.raw_parser_payload?.trip_order_id === to.id,
      );

      // 2. Либо по совпадению client_id (только для заявок без привязки к другому trip_order_id)
      if (!match) {
        match = (existingOrders || []).find(
          (o: any) =>
            o.status !== 'cancelled' &&
            !assignedOrderIds.has(o.id) &&
            !o.raw_parser_payload?.trip_order_id &&
            (o.client_id === cpId || o.client_id === to.counterparty_id),
        );
      }

      // 3. Либо по текстовому совпадению в loading_org_name, если client_id был null
      if (!match) {
        match = (existingOrders || []).find(
          (o: any) =>
            o.status !== 'cancelled' &&
            !assignedOrderIds.has(o.id) &&
            !o.raw_parser_payload?.trip_order_id &&
            !o.client_id &&
            o.loading_org_name &&
            isStrictDocCounterparty(o.loading_org_name, options?.orgSettings) &&
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
            ...billingDocs,
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

        const { error: updateErr } = await (supabase.from('orders') as any)
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

        if (!updateErr) {
          result.updated += 1;
        } else {
          console.error('Ошибка обновления заявки docs_collection для рейса:', updateErr.message);
        }
      } else {
        // Создаем новую заявку под этот заказ рейса со статусом 'docs_collection'
        const finalDocNumber = String(trip.trip_number || 'б/н');
        const tripDate = trip.started_at
          ? String(trip.started_at).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        const newOrderPayload: Record<string, any> = {
          ...(orgId ? { organization_id: orgId } : {}),
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
            auto_synced_from_trip: true,
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
          result.created += 1;
        } else if (insertErr) {
          console.error('Ошибка создания заявки docs_collection для рейса:', insertErr.message);
        }
      }
    }

    // Если в рейсе удалили trip_order строгого контрагента (или сменили на нестрогого),
    // автосозданные заявки со ссылкой на несуществующий/отменённый trip_order_id переводим в cancelled
    for (const o of existingOrders || []) {
      const linkedToId = o.raw_parser_payload?.trip_order_id;
      if (
        linkedToId &&
        !validTripOrderIds.has(linkedToId) &&
        !assignedOrderIds.has(o.id) &&
        o.status === 'docs_collection' &&
        !o.raw_parser_payload?.billing_docs?.client_accepted_edo
      ) {
        const stillExistsInTrip = ((trip.trip_orders as any[]) || []).some(
          (to: any) => to.id === linkedToId && to.lifecycle_status !== 'cancelled',
        );
        const nextStatus = stillExistsInTrip ? 'completed' : 'cancelled';
        const { error: cleanupErr } = await (supabase.from('orders') as any)
          .update({
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', o.id);
        if (!cleanupErr) {
          result.cancelled += 1;
        }
      }
    }
  } catch (err: any) {
    console.error('Ошибка в syncStrictOrdersForTrip:', err?.message || err);
  }

  return result;
}

/**
 * Автоподтягивание недостающих заявок в «Сбор документов» (docs_collection)
 * для всех утверждённых заказов рейсов строгих контрагентов, которых ещё нет в таблице orders.
 *
 * Закрывает разрыв для старых рейсов, рейсов утверждённых через MiniApp,
 * и рейсов, в которые заказы добавлялись/редактировались после утверждения.
 */
export async function backfillStrictDocOrders(
  supabase: any,
  options?: SyncStrictOrdersOptions & { sinceDays?: number },
): Promise<{ syncedTrips: number; created: number; updated: number }> {
  const summary = { syncedTrips: 0, created: 0, updated: 0 };

  try {
    let toQuery = (supabase.from('trip_orders') as any)
      .select(
        `
        id, trip_id, organization_id, settlement_status, lifecycle_status,
        counterparty:counterparties(id, name),
        trip:trips!inner(id, lifecycle_status, started_at)
      `,
      )
      .eq('lifecycle_status', 'approved')
      .eq('trip.lifecycle_status', 'approved')
      .eq('settlement_status', 'pending');

    if (options?.organizationId) {
      toQuery = toQuery.eq('organization_id', options.organizationId);
    }

    const { data: pendingTripOrders, error: toErr } = await toQuery;
    if (toErr || !pendingTripOrders?.length) return summary;

    const strictTripOrders = pendingTripOrders.filter(
      (to: any) =>
        to.trip_id &&
        to.counterparty?.name &&
        isStrictDocCounterparty(to.counterparty.name, options?.orgSettings),
    );

    if (strictTripOrders.length === 0) return summary;

    const tripIds = Array.from(new Set(strictTripOrders.map((to: any) => String(to.trip_id))));

    let ordQuery = (supabase.from('orders') as any)
      .select('id, active_trip_id, status, raw_parser_payload')
      .in('active_trip_id', tripIds)
      .neq('status', 'cancelled');

    if (options?.organizationId) {
      ordQuery = ordQuery.eq('organization_id', options.organizationId);
    }

    const { data: existingOrders } = await ordQuery;

    // Для каждого trip_id проверяем, покрыты ли все его strict trip_orders заявками в orders
    const coveredByTripOrderId = new Set<string>();
    const orderCountByTripId = new Map<string, number>();

    for (const o of existingOrders || []) {
      const linkedToId = o.raw_parser_payload?.trip_order_id;
      if (linkedToId) {
        coveredByTripOrderId.add(String(linkedToId));
      }
      if (o.active_trip_id) {
        const key = String(o.active_trip_id);
        orderCountByTripId.set(key, (orderCountByTripId.get(key) || 0) + 1);
      }
    }

    const tripsNeedingSync = new Set<string>();
    const strictCountByTripId = new Map<string, number>();
    for (const to of strictTripOrders) {
      const tid = String(to.trip_id);
      strictCountByTripId.set(tid, (strictCountByTripId.get(tid) || 0) + 1);
    }

    for (const to of strictTripOrders) {
      const tid = String(to.trip_id);
      const hasExactLink = coveredByTripOrderId.has(String(to.id));
      const existingCount = orderCountByTripId.get(tid) || 0;
      const requiredCount = strictCountByTripId.get(tid) || 0;

      if (!hasExactLink && existingCount < requiredCount) {
        tripsNeedingSync.add(tid);
      }
    }

    for (const tid of tripsNeedingSync) {
      const res = await syncStrictOrdersForTrip(supabase, tid, {
        organizationId: options?.organizationId,
        orgSettings: options?.orgSettings,
      });
      summary.syncedTrips += 1;
      summary.created += res.created;
      summary.updated += res.updated;
    }
  } catch (err: any) {
    console.error('Ошибка в backfillStrictDocOrders:', err?.message || err);
  }

  return summary;
}

/**
 * Синхронизирует выставленный в Дебиторке номер/дату счёта обратно в таблицу orders
 * (raw_parser_payload.billing_docs), чтобы «Сбор документов» сразу видел выставленный счёт.
 */
export async function syncInvoiceToOrder(
  supabase: any,
  tripOrderId: string,
  invoice: {
    invoice_number: string;
    invoice_date: string;
    trip_id?: string | null;
    counterparty_id?: string | null;
    organization_id?: string | null;
  },
): Promise<boolean> {
  try {
    // 1. Сначала ищем точное совпадение по raw_parser_payload->>trip_order_id
    let query = (supabase.from('orders') as any)
      .select('id, raw_parser_payload')
      .eq('raw_parser_payload->>trip_order_id', tripOrderId)
      .neq('status', 'cancelled');

    if (invoice.organization_id) {
      query = query.eq('organization_id', invoice.organization_id);
    }

    let { data: matchedOrders } = await query;

    // 2. Fallback: если привязки по trip_order_id ещё нет, ищем по active_trip_id + client_id
    if ((!matchedOrders || matchedOrders.length === 0) && invoice.trip_id) {
      let fallbackQuery = (supabase.from('orders') as any)
        .select('id, raw_parser_payload')
        .eq('active_trip_id', invoice.trip_id)
        .neq('status', 'cancelled');

      if (invoice.counterparty_id) {
        fallbackQuery = fallbackQuery.eq('client_id', invoice.counterparty_id);
      }
      if (invoice.organization_id) {
        fallbackQuery = fallbackQuery.eq('organization_id', invoice.organization_id);
      }

      const { data: fallbackOrders } = await fallbackQuery.limit(1);
      matchedOrders = fallbackOrders;
    }

    if (!matchedOrders || matchedOrders.length === 0) return false;

    const now = new Date().toISOString();
    for (const ord of matchedOrders) {
      const payload = ord.raw_parser_payload || {};
      const billingDocs = payload.billing_docs || {};
      const updatedPayload = {
        ...payload,
        trip_order_id: payload.trip_order_id || tripOrderId,
        billing_docs: {
          ...billingDocs,
          invoice_issued: true,
          invoice_number: invoice.invoice_number,
          invoice_date: invoice.invoice_date,
        },
      };

      await (supabase.from('orders') as any)
        .update({
          raw_parser_payload: updatedPayload,
          updated_at: now,
        })
        .eq('id', ord.id);
    }

    return true;
  } catch (err: any) {
    console.error('Ошибка в syncInvoiceToOrder:', err?.message || err);
    return false;
  }
}
