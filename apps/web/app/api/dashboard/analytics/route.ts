/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month') || 'month';
    const dateParam = searchParams.get('date'); // YYYY-MM-DD

    const ref = dateParam ? new Date(dateParam + 'T12:00:00Z') : new Date();

    let startIso: string;
    let endIso: string;
    let periodLabel: string;

    if (period === 'day') {
      const iso = ref.toISOString().slice(0, 10);
      startIso = `${iso}T00:00:00.000Z`;
      endIso = `${iso}T23:59:59.999Z`;
      periodLabel = ref.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      });
    } else if (period === 'week') {
      const d = new Date(ref);
      const day = d.getUTCDay();
      const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0));
      const sunday = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff + 6, 23, 59, 59, 999),
      );
      startIso = monday.toISOString();
      endIso = sunday.toISOString();
      periodLabel = `${monday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${sunday.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    } else {
      // Month
      const y = ref.getUTCFullYear();
      const m = ref.getUTCMonth();
      startIso = new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString();
      endIso = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString();
      periodLabel = ref.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    }

    const supabase = createAdminClient();

    // 1. Fetch Trips in range
    const { data: trips, error: tripsErr } = await supabase
      .from('trips')
      .select(
        `
        id, trip_number, started_at, ended_at, status, lifecycle_status,
        asset:assets(id, short_name, reg_number),
        trip_orders(id, amount, driver_pay, loader_pay, loader2_pay, payment_method, lifecycle_status),
        trip_expenses(id, amount, category_id, category:transaction_categories(id, name, code))
      `,
      )
      .gte('started_at', startIso)
      .lte('started_at', endIso)
      .order('started_at', { ascending: false });

    if (tripsErr) throw tripsErr;

    let tripsCount = 0;
    let tripRevenue = 0;
    let tripDriverPay = 0;
    let tripLoaderPay = 0;
    let tripFuel = 0;
    let tripOtherExpenses = 0;

    const incomeBreakdown: Record<
      string,
      { label: string; amount: number; count: number; color: string }
    > = {
      bank_invoice: { label: 'Безнал (Юрлица по счету)', amount: 0, count: 0, color: 'bg-sky-500' },
      cash: { label: 'Оплаты наличными в кассу', amount: 0, count: 0, color: 'bg-emerald-500' },
      debt_cash: { label: 'Долг клиента (наличные)', amount: 0, count: 0, color: 'bg-amber-500' },
      qr: { label: 'Оплаты по QR-коду / Эквайринг', amount: 0, count: 0, color: 'bg-purple-500' },
      card_driver: {
        label: 'Перевод на карту водителя',
        amount: 0,
        count: 0,
        color: 'bg-blue-500',
      },
    };

    const vehicleMap: Record<
      string,
      {
        id: string;
        name: string;
        reg_number: string;
        trip_numbers: number[];
        revenue: number;
        costs: number;
        profit: number;
      }
    > = {};

    for (const t of trips || []) {
      tripsCount++;
      const activeOrders = (t.trip_orders || []).filter(
        (o: any) => o.lifecycle_status !== 'cancelled',
      );
      let tRev = 0;
      let tPay = 0;
      let tFuel = 0;
      let tExp = 0;

      for (const o of activeOrders) {
        const amt = parseFloat(o.amount || '0');
        tRev += amt;
        const pm = o.payment_method || 'cash';
        if (incomeBreakdown[pm]) {
          incomeBreakdown[pm].amount += amt;
          incomeBreakdown[pm].count += 1;
        }

        const dPay = parseFloat(o.driver_pay || '0');
        const lPay = parseFloat(o.loader_pay || '0') + parseFloat(o.loader2_pay || '0');
        tPay += dPay + lPay;
        tripDriverPay += dPay;
        tripLoaderPay += lPay;
      }

      for (const e of t.trip_expenses || []) {
        const amt = parseFloat(e.amount || '0');
        const catCode = e.category?.code;
        const catName = e.category?.name;
        if (catCode === 'FUEL' || catName === 'ГСМ' || catName?.toLowerCase().includes('топлив')) {
          tFuel += amt;
        } else {
          tExp += amt;
        }
      }

      tripRevenue += tRev;
      tripFuel += tFuel;
      tripOtherExpenses += tExp;

      const vId = t.asset?.id || 'other';
      const vName = t.asset?.short_name || 'Автомобиль компании';
      const vReg = t.asset?.reg_number || '';
      if (!vehicleMap[vId]) {
        vehicleMap[vId] = {
          id: vId,
          name: vName,
          reg_number: vReg,
          trip_numbers: [],
          revenue: 0,
          costs: 0,
          profit: 0,
        };
      }
      if (t.trip_number) vehicleMap[vId].trip_numbers.push(t.trip_number);
      vehicleMap[vId].revenue += tRev;
      vehicleMap[vId].costs += tPay + tFuel + tExp;
      vehicleMap[vId].profit += tRev - (tPay + tFuel + tExp);
    }

    // 2. Fetch Garage Service Orders in range
    const { data: serviceOrders } = await supabase
      .from('service_orders')
      .select(
        `
        id, order_number, created_at,
        service_order_works(price_client, wage_amount, status),
        service_order_parts(client_price, unit_price, quantity, status)
      `,
      )
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    let garageRev = 0;
    let garageMechanicPay = 0;
    let garagePartsCost = 0;

    for (const so of serviceOrders || []) {
      for (const w of so.service_order_works || []) {
        garageRev += parseFloat(w.price_client || '0');
        garageMechanicPay += parseFloat(w.wage_amount || '0');
      }
      for (const p of so.service_order_parts || []) {
        const qty = parseFloat(p.quantity || '1');
        garageRev += parseFloat(p.client_price || '0') * qty;
        garagePartsCost += parseFloat(p.unit_price || '0') * qty;
      }
    }

    // 3. Standalone Operational Transactions (excluding wage payouts and transfers which are already counted via trips)
    const { data: generalExpenses } = await supabase
      .from('transactions')
      .select(
        `
        id, amount, direction, description, created_at,
        category:transaction_categories(code, name)
      `,
      )
      .eq('direction', 'expense')
      .gte('created_at', startIso)
      .lte('created_at', endIso);

    let generalOpExpenses = 0;
    for (const tx of generalExpenses || []) {
      const desc = (tx.description || '').toLowerCase();
      const catCode = tx.category?.code || '';
      const catName = (tx.category?.name || '').toLowerCase();

      // Skip internal transfers, loan repayments, and direct wage payouts (already tracked in trip payroll)
      if (
        catCode === 'TRANSFER' ||
        catCode === 'LOAN_REPAYMENT' ||
        desc.includes('выплата зарплаты') ||
        desc.includes('зп:') ||
        desc.includes('долг механику') ||
        catName.includes('зарплата')
      ) {
        continue;
      }
      generalOpExpenses += parseFloat(tx.amount || '0');
    }

    // Aggregated Numbers
    const totalIncome = tripRevenue + garageRev;
    const totalPayroll = tripDriverPay + tripLoaderPay + garageMechanicPay;
    const totalFuel = tripFuel;
    const totalParts = garagePartsCost;
    const totalOther = tripOtherExpenses + generalOpExpenses;
    const totalExpenses = totalPayroll + totalFuel + totalParts + totalOther;

    const netSaldo = totalIncome - totalExpenses;
    const marginPct = totalIncome > 0 ? Math.round((netSaldo / totalIncome) * 1000) / 10 : 0;

    // Expense breakdown list
    const expenseBreakdown = [
      {
        id: 'fuel',
        label: 'Топливо / ГСМ (АИ-92, ДТ)',
        amount: totalFuel,
        pct: totalExpenses > 0 ? Math.round((totalFuel / totalExpenses) * 1000) / 10 : 0,
        color: 'bg-rose-500',
      },
      {
        id: 'payroll',
        label: 'Зарплата водителям и грузчикам',
        amount: totalPayroll,
        pct: totalExpenses > 0 ? Math.round((totalPayroll / totalExpenses) * 1000) / 10 : 0,
        color: 'bg-amber-500',
      },
      {
        id: 'parts',
        label: 'Запчасти и обслуживание СТО',
        amount: totalParts,
        pct: totalExpenses > 0 ? Math.round((totalParts / totalExpenses) * 1000) / 10 : 0,
        color: 'bg-blue-500',
      },
      {
        id: 'other',
        label: 'Прочие операционные расходы',
        amount: totalOther,
        pct: totalExpenses > 0 ? Math.round((totalOther / totalExpenses) * 1000) / 10 : 0,
        color: 'bg-slate-500',
      },
    ];

    // Income breakdown list
    const incomeItems = Object.values(incomeBreakdown)
      .filter((v) => v.amount > 0 || totalIncome === 0)
      .map((v) => ({
        id: v.label,
        label: v.label,
        amount: v.amount,
        pct: totalIncome > 0 ? Math.round((v.amount / totalIncome) * 1000) / 10 : 0,
        count: v.count,
        color: v.color,
      }));

    if (garageRev > 0) {
      incomeItems.push({
        id: 'garage',
        label: 'Услуги автосервиса и запчасти (СТО)',
        amount: garageRev,
        pct: totalIncome > 0 ? Math.round((garageRev / totalIncome) * 1000) / 10 : 0,
        count: (serviceOrders || []).length,
        color: 'bg-indigo-500',
      });
    }

    return NextResponse.json({
      period,
      periodLabel,
      startIso,
      endIso,
      summary: {
        totalIncome,
        totalExpenses,
        netSaldo,
        marginPct,
      },
      reviewStats: {
        tripsCount,
        revenue: tripRevenue,
        payroll: totalPayroll,
        fuel: totalFuel,
        otherExpenses: tripOtherExpenses,
        profit: tripRevenue - (totalPayroll + totalFuel + tripOtherExpenses),
        vehicles: Object.values(vehicleMap).sort((a, b) => b.revenue - a.revenue),
      },
      incomeBreakdown: incomeItems,
      expenseBreakdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
