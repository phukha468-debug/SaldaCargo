/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const FUEL_CATEGORY_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
const OVERHEAD_CODES = ['REPAIR_PARTS', 'REPAIR_EXTERNAL', 'TAX', 'INSURANCE'];

export const DERYABIN_ID = '20000000-0000-0000-0000-000000000001';
export const NOVIKOV_ID = '20000000-0000-0000-0000-000000000002';
export const ROMASHIM_ID = '20000000-0000-0000-0000-000000000003';

function last6MonthKeys(): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

async function fetchAllRows<T = any>(
  queryBuilder: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder(from, to);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

/** GET /api/counterparties — единый список контрагентов (клиенты + поставщики) с аналитикой и взаимными долгами */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get('active') === '1';
    const filterType = searchParams.get('type'); // 'client' | 'supplier' | 'all'

    const supabase = createAdminClient();
    const monthKeys = last6MonthKeys();

    let q = (supabase as any)
      .from('counterparties')
      .select(
        'id, name, phone, email, type, credit_limit, payable_amount, notes, is_active, is_regular, is_legal_entity',
      )
      .order('name');

    if (onlyActive) q = q.eq('is_active', true);
    if (filterType === 'client') q = q.in('type', ['client', 'both']);
    else if (filterType === 'supplier') q = q.in('type', ['supplier', 'both']);

    const { data: counterparties, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const cpList = counterparties ?? [];
    if (cpList.length === 0) return NextResponse.json([]);

    const cpIds = cpList.map((c: any) => c.id);
    const supplierIds = cpList
      .filter((c: any) => c.type === 'supplier' || c.type === 'both')
      .map((c: any) => c.id);

    // Коэффициент накладных расходов (налоги, запчасти, ремонты)
    const { data: overheadCategories } = await (supabase as any)
      .from('transaction_categories')
      .select('id')
      .in('code', OVERHEAD_CODES);

    const overheadCatIds = (overheadCategories ?? []).map((c: any) => c.id);

    // Параллельная загрузка базовых данных
    const [overheadTxList, overheadTripExpList, allCompanyOrders, orders, supplierTransactions] =
      await Promise.all([
        overheadCatIds.length > 0
          ? fetchAllRows((from, to) =>
              (supabase as any)
                .from('transactions')
                .select('amount')
                .in('category_id', overheadCatIds)
                .eq('direction', 'expense')
                .eq('lifecycle_status', 'approved')
                .eq('settlement_status', 'completed')
                .range(from, to),
            )
          : Promise.resolve([]),
        overheadCatIds.length > 0
          ? fetchAllRows((from, to) =>
              (supabase as any)
                .from('trip_expenses')
                .select('amount')
                .in('category_id', overheadCatIds)
                .range(from, to),
            )
          : Promise.resolve([]),
        fetchAllRows((from, to) =>
          (supabase as any)
            .from('trip_orders')
            .select('amount, trips!inner(lifecycle_status)')
            .eq('lifecycle_status', 'approved')
            .eq('trips.lifecycle_status', 'approved')
            .range(from, to),
        ),
        // Заказы клиентов
        fetchAllRows((from, to) =>
          (supabase as any)
            .from('trip_orders')
            .select(
              'counterparty_id, trip_id, amount, driver_pay, loader_pay, payment_method, lifecycle_status, settlement_status, trip:trips!inner(started_at, lifecycle_status)',
            )
            .in('counterparty_id', cpIds)
            .eq('lifecycle_status', 'approved')
            .eq('trips.lifecycle_status', 'approved')
            .range(from, to),
        ),
        // Транзакции по поставщикам
        supplierIds.length > 0
          ? fetchAllRows((from, to) =>
              (supabase as any)
                .from('transactions')
                .select(
                  'id, amount, counterparty_id, settlement_status, description, created_at, direction',
                )
                .in('counterparty_id', supplierIds)
                .eq('lifecycle_status', 'approved')
                .range(from, to),
            )
          : Promise.resolve([]),
      ]);

    const totalOverhead = [...overheadTxList, ...overheadTripExpList].reduce(
      (s: number, e: any) => s + parseFloat(e.amount ?? '0'),
      0,
    );

    const totalCompanyRevenue = allCompanyOrders.reduce(
      (s: number, o: any) => s + parseFloat(o.amount ?? '0'),
      0,
    );
    const overhead_pct = totalCompanyRevenue > 0 ? totalOverhead / totalCompanyRevenue : 0;

    // Расчет расходов на ГСМ для каждого рейса
    const allTripIds = [
      ...new Set((orders ?? []).map((o: any) => o.trip_id).filter(Boolean)),
    ] as string[];

    const fuelExpenses =
      allTripIds.length > 0
        ? await fetchAllRows((from, to) =>
            (supabase as any)
              .from('trip_expenses')
              .select('trip_id, amount')
              .in('trip_id', allTripIds)
              .eq('category_id', FUEL_CATEGORY_ID)
              .range(from, to),
          )
        : [];

    const tripFuelMap = new Map<string, number>();
    for (const e of fuelExpenses ?? []) {
      tripFuelMap.set(e.trip_id, (tripFuelMap.get(e.trip_id) ?? 0) + parseFloat(e.amount ?? '0'));
    }

    const allTripOrders =
      allTripIds.length > 0
        ? await fetchAllRows((from, to) =>
            (supabase as any)
              .from('trip_orders')
              .select('trip_id, amount, lifecycle_status, settlement_status')
              .in('trip_id', allTripIds)
              .eq('lifecycle_status', 'approved')
              .neq('lifecycle_status', 'cancelled')
              .range(from, to),
          )
        : [];

    const tripTotalRevenueMap = new Map<string, number>();
    for (const o of allTripOrders ?? []) {
      tripTotalRevenueMap.set(
        o.trip_id,
        (tripTotalRevenueMap.get(o.trip_id) ?? 0) + parseFloat(o.amount ?? '0'),
      );
    }

    // Расчет долгов поставщикам
    const sumArr = (rows: any[]) =>
      (rows ?? []).reduce((s: number, r: any) => s + parseFloat(r.amount ?? '0'), 0);

    const supplierDebtMap = new Map<string, number>();

    for (const sId of supplierIds) {
      const sTx = supplierTransactions.filter((t: any) => t.counterparty_id === sId);
      const pending = sumArr(
        sTx.filter((t: any) => t.settlement_status === 'pending' && t.direction === 'expense'),
      );
      const payments = sumArr(
        sTx.filter((t: any) => t.settlement_status === 'completed' && t.direction === 'expense'),
      );

      supplierDebtMap.set(sId, Math.max(0, pending - payments));
    }

    // Статистика по каждому контрагенту
    const now = Date.now();

    type ClientStats = {
      total_revenue: number;
      revenue_30d: number;
      revenue_orders: number;
      driver_costs: number;
      trip_ids: Set<string>;
      trip_client_revenue: Map<string, number>;
      last_trip_at: string | null;
      payments: Record<string, number>;
      monthly: Record<string, number>;
      unpaid_amount: number;
    };

    const statsMap = new Map<string, ClientStats>();
    for (const cp of cpList) {
      statsMap.set(cp.id, {
        total_revenue: 0,
        revenue_30d: 0,
        revenue_orders: 0,
        driver_costs: 0,
        trip_ids: new Set(),
        trip_client_revenue: new Map(),
        last_trip_at: null,
        payments: {},
        monthly: {},
        unpaid_amount: 0,
      });
    }

    for (const o of orders ?? []) {
      const s = statsMap.get(o.counterparty_id);
      if (!s) continue;

      const amount = parseFloat(o.amount ?? '0');
      const startedAt: string | null = o.trip?.started_at ?? null;

      if (o.trip_id) s.trip_ids.add(o.trip_id);
      if (startedAt && (!s.last_trip_at || startedAt > s.last_trip_at)) {
        s.last_trip_at = startedAt;
      }

      s.total_revenue += amount;
      s.revenue_orders++;
      s.driver_costs += parseFloat(o.driver_pay ?? '0') + parseFloat(o.loader_pay ?? '0');
      s.trip_client_revenue.set(o.trip_id, (s.trip_client_revenue.get(o.trip_id) ?? 0) + amount);

      if (startedAt && now - new Date(startedAt).getTime() <= THIRTY_DAYS) {
        s.revenue_30d += amount;
      }
      s.payments[o.payment_method] = (s.payments[o.payment_method] ?? 0) + amount;
      const mk = startedAt ? startedAt.slice(0, 7) : null;
      if (mk && monthKeys.includes(mk)) {
        s.monthly[mk] = (s.monthly[mk] ?? 0) + amount;
      }

      // Дебиторка (неоплаченные рейсы)
      if (o.settlement_status === 'pending') {
        s.unpaid_amount += amount;
      }
    }

    const result = cpList.map((cp: any) => {
      const s = statsMap.get(cp.id)!;
      const isSupplier = cp.type === 'supplier' || cp.type === 'both';
      const isClient = cp.type === 'client' || cp.type === 'both';

      // Распределение ГСМ
      let fuelAllocated = 0;
      for (const [tripId, clientRev] of s.trip_client_revenue) {
        const tripTotal = tripTotalRevenueMap.get(tripId) ?? 0;
        const tripFuel = tripFuelMap.get(tripId) ?? 0;
        if (tripTotal > 0 && tripFuel > 0) {
          fuelAllocated += (clientRev / tripTotal) * tripFuel;
        }
      }

      const netProfit =
        s.total_revenue - s.driver_costs - fuelAllocated - s.total_revenue * overhead_pct;

      const preferredPayment =
        Object.entries(s.payments)
          .filter(([pm]) => pm !== 'debt_cash')
          .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

      const totalForPct = s.total_revenue || 1;
      const paymentBreakdown: Record<string, number> = {};
      for (const [pm, val] of Object.entries(s.payments)) {
        paymentBreakdown[pm] = Math.round((val / totalForPct) * 100);
      }

      // Кредиторская задолженность (наш долг поставщику)
      const manualPayable = parseFloat(cp.payable_amount ?? '0');
      const calcSupplierDebt = isSupplier ? (supplierDebtMap.get(cp.id) ?? 0) : 0;
      // Если администратор задал manualPayable вручную (> 0), приоритет у ручного значения.
      // Иначе используется расчетная задолженность по транзакциям/топливу (например, для автоначисления ГСМ).
      const finalPayableDebt = manualPayable > 0 ? manualPayable : calcSupplierDebt;

      // Дебиторская задолженность (клиент должен нам)
      const finalReceivableDebt = isClient ? s.unpaid_amount : 0;

      // Сальдо: положительное = нам должны, отрицательное = мы должны
      const netBalance = finalReceivableDebt - finalPayableDebt;

      // Категория поставщика
      let supplierCategory = 'Поставщик';
      if (
        cp.id === DERYABIN_ID ||
        cp.name.toLowerCase().includes('гсм') ||
        cp.name.toLowerCase().includes('топлив')
      ) {
        supplierCategory = 'ГСМ / Топливо';
      } else if (cp.id === NOVIKOV_ID || cp.name.toLowerCase().includes('запчаст')) {
        supplierCategory = 'Автозапчасти';
      } else if (
        cp.id === ROMASHIM_ID ||
        cp.name.toLowerCase().includes('сервис') ||
        cp.name.toLowerCase().includes('ремонт')
      ) {
        supplierCategory = 'СТО и Сервис';
      } else if (cp.name.toLowerCase().includes('аренд')) {
        supplierCategory = 'Аренда';
      }

      return {
        id: cp.id,
        name: cp.name,
        type: cp.type || 'client', // 'client' | 'supplier' | 'both'
        phone: cp.phone ?? null,
        email: cp.email ?? null,
        notes: cp.notes ?? null,
        credit_limit: cp.credit_limit ?? null,
        is_active: cp.is_active,
        is_regular: cp.is_regular ?? false,
        is_legal_entity: cp.is_legal_entity ?? false,
        // Взаиморасчеты:
        payable_amount: finalPayableDebt.toFixed(2), // Мы должны
        receivable_amount: finalReceivableDebt.toFixed(2), // Нам должны
        net_balance: netBalance.toFixed(2), // Сальдо
        supplier_category: isSupplier ? supplierCategory : null,
        // Показатели клиента:
        total_revenue: s.total_revenue.toFixed(2),
        revenue_30d: s.revenue_30d.toFixed(2),
        net_profit: netProfit.toFixed(2),
        margin_pct: s.total_revenue > 0 ? Math.round((netProfit / s.total_revenue) * 1000) / 10 : 0,
        overhead_pct: Math.round(overhead_pct * 10000) / 10000,
        trips_count: s.trip_ids.size,
        orders_count: s.revenue_orders,
        avg_order: s.revenue_orders > 0 ? (s.total_revenue / s.revenue_orders).toFixed(2) : '0.00',
        last_trip_at: s.last_trip_at,
        preferred_payment: preferredPayment,
        payment_breakdown: paymentBreakdown,
        monthly: monthKeys.map((k) => (s.monthly[k] ?? 0).toFixed(2)),
        month_labels: monthKeys.map((k) => {
          const parts = k.split('-').map(Number);
          const y = parts[0] ?? 2026;
          const m = parts[1] ?? 1;
          return new Date(y, m - 1, 1).toLocaleDateString('ru-RU', { month: 'short' });
        }),
      };
    });

    result.sort((a: any, b: any) => {
      // Поставщики с долгами или клиенты с выручкой
      const debtA = parseFloat(a.payable_amount) + parseFloat(a.receivable_amount);
      const debtB = parseFloat(b.payable_amount) + parseFloat(b.receivable_amount);
      return debtB - debtA || parseFloat(b.total_revenue) - parseFloat(a.total_revenue);
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

/** POST /api/counterparties — создать контрагента (клиента или поставщика) */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name: string;
      type?: 'client' | 'supplier' | 'both';
      phone?: string;
      email?: string;
      credit_limit?: string;
      payable_amount?: string;
      notes?: string;
      is_legal_entity?: boolean;
      is_regular?: boolean;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from('counterparties') as any)
      .insert({
        name: body.name.trim(),
        type: body.type || 'client',
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        credit_limit: body.credit_limit || null,
        payable_amount: body.payable_amount ? parseFloat(body.payable_amount).toFixed(2) : '0.00',
        notes: body.notes?.trim() || null,
        is_active: true,
        is_regular: body.is_regular !== undefined ? body.is_regular : false,
        is_legal_entity: Boolean(body.is_legal_entity),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
