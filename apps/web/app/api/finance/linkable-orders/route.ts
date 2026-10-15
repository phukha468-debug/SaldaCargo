/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/finance/linkable-orders
 * Поиск заказов рейсов автопарка для привязки к банковской операции
 * Поддерживает:
 * - Поиск по номеру рейса (827), имени клиента, водителю, сумме
 * - Фильтр по дате (например 2026-10-14) или периоду (дни назад)
 * - Умный матчинг по сумме и дате из назначения платежа
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const dateParam = searchParams.get('date'); // YYYY-MM-DD
    const daysParam = parseInt(searchParams.get('days') || '14', 10);
    const targetAmount = parseFloat(searchParams.get('targetAmount') || '0');
    const targetDesc = searchParams.get('targetDesc') || '';
    const operationDate = searchParams.get('operationDate') || '';

    // Извлечение даты из назначения платежа, например "ЗА 14/10/2026;РУСНАК..." или "14.10.2026"
    let extractedDate: string | null = null;
    const dateMatch = targetDesc.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
    if (dateMatch) {
      const day = dateMatch[1]!.padStart(2, '0');
      const month = dateMatch[2]!.padStart(2, '0');
      let year = dateMatch[3];
      if (!year) {
        year = new Date().getFullYear().toString();
      } else if (year.length === 2) {
        year = `20${year}`;
      }
      extractedDate = `${year}-${month}-${day}`;
    }

    const supabase = createAdminClient();

    // Определяем временные границы
    let dateFrom: string;
    let dateTo: string;

    if (dateParam) {
      dateFrom = `${dateParam}T00:00:00.000Z`;
      dateTo = `${dateParam}T23:59:59.999Z`;
    } else {
      const now = new Date();
      const past = new Date(now.getTime() - daysParam * 24 * 60 * 60 * 1000);
      dateFrom = past.toISOString();
      dateTo = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    // Запрос заказов рейсов с информацией о рейсе, водителе и контрагенте
    let query = (supabase.from('trip_orders') as any)
      .select(
        `
        id, trip_id, amount, payment_method, settlement_status, lifecycle_status, description, created_at,
        counterparty:counterparties(id, name, inn, contact_person),
        trip:trips!inner(
          id, trip_number, started_at, created_at, lifecycle_status,
          driver:users!trips_driver_id_fkey(id, name)
        )
      `,
      )
      .neq('lifecycle_status', 'cancelled')
      .order('created_at', { ascending: false });

    if (dateParam) {
      query = query.gte('created_at', dateFrom).lte('created_at', dateTo);
    } else {
      query = query.gte('created_at', dateFrom);
    }

    const { data: rawOrders, error } = await query;

    if (error) {
      console.error('Error fetching linkable orders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orders = rawOrders || [];
    const orderIds = orders.map((o: any) => o.id);

    // Получаем список существующих транзакций, привязанных к этим заказам
    const { data: linkedTxs } =
      orderIds.length > 0
        ? await (supabase.from('transactions') as any)
            .select('id, trip_order_id, idempotency_key, description, amount')
            .in('trip_order_id', orderIds)
        : { data: [] };

    const linkedOrderIds = new Set((linkedTxs || []).map((t: any) => t.trip_order_id));

    // Фильтрация и вычисление score для сортировки
    const searchLower = search.toLowerCase();
    const targetDescLower = targetDesc.toLowerCase();

    const scoredOrders = orders
      .filter((o: any) => {
        if (!search) return true;

        const tripNum = String(o.trip?.trip_number || '');
        const driverName = (o.trip?.driver?.name || '').toLowerCase();
        const clientName = (o.counterparty?.name || '').toLowerCase();
        const desc = (o.description || '').toLowerCase();
        const amt = String(o.amount || '');

        return (
          tripNum.includes(searchLower) ||
          driverName.includes(searchLower) ||
          clientName.includes(searchLower) ||
          desc.includes(searchLower) ||
          amt.includes(searchLower)
        );
      })
      .map((o: any) => {
        const amt = parseFloat(o.amount || '0');
        const isMatchAmt = targetAmount > 0 && Math.abs(amt - targetAmount) < 0.01;

        // Дата рейса
        const tripDateIso = o.trip?.started_at || o.created_at;
        const tripDateStr = tripDateIso ? tripDateIso.slice(0, 10) : '';

        // Совпадение по дате из описания платежа или по дате операции
        const isMatchExtractedDate = extractedDate ? tripDateStr === extractedDate : false;
        const isMatchOpDate = operationDate ? tripDateStr === operationDate.slice(0, 10) : false;

        // Совпадение по имени клиента / контрагента
        const clientName = (o.counterparty?.name || '').toLowerCase();
        let isMatchClient = false;
        if (clientName && targetDescLower) {
          const parts = clientName.split(/\s+/).filter((p: string) => p.length >= 3);
          isMatchClient = parts.some((p: string) => targetDescLower.includes(p));
        }

        const isAlreadyLinked = linkedOrderIds.has(o.id);

        let score = 0;
        if (isMatchAmt) score += 100;
        if (isMatchExtractedDate) score += 80;
        else if (isMatchOpDate) score += 30;
        if (isMatchClient) score += 40;
        if (!isAlreadyLinked) score += 20;

        return {
          ...o,
          order_amount: amt,
          trip_date: tripDateStr,
          is_match_amount: isMatchAmt,
          is_match_date: isMatchExtractedDate || isMatchOpDate,
          is_match_client: isMatchClient,
          is_already_linked: isAlreadyLinked,
          score,
        };
      });

    // Сортировка: сначала с наибольшим баллом (идеальные совпадения), затем по дате рейса свежие
    scoredOrders.sort((a: any, b: any) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      extractedDate,
      orders: scoredOrders,
    });
  } catch (err: any) {
    console.error('Error in linkable-orders:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
