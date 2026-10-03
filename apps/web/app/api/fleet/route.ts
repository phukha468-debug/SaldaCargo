/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function getPeriodRange(period: string): { start: string; end: string; months: number } {
  const now = new Date();
  if (period === 'last_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
      end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString(),
      months: 1,
    };
  }
  if (period === 'quarter') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
      end: now.toISOString(),
      months: 3,
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: now.toISOString(),
    months: 1,
  };
}

function parseVehicleDocs(
  notes: string | null,
  insuranceExpires: string | null,
  inspectionExpires: string | null,
) {
  let docsObj: Record<string, any> = {};
  if (notes) {
    const match = notes.match(/\[DOCS_DATA:(.*?)\]/s);
    if (match && match[1]) {
      try {
        docsObj = JSON.parse(match[1]);
      } catch {}
    } else {
      try {
        if (notes.trim().startsWith('{') && notes.trim().endsWith('}')) {
          docsObj = JSON.parse(notes.trim());
        }
      } catch {}
    }
  }

  return {
    insurance_expires_at: insuranceExpires || docsObj.insurance_expires_at || '',
    insurance_policy: docsObj.insurance_policy || '',
    inspection_expires_at: inspectionExpires || docsObj.inspection_expires_at || '',
    inspection_number: docsObj.inspection_number || '',
    moscow_pass_required: Boolean(docsObj.moscow_pass_required),
    moscow_pass_expires_at: docsObj.moscow_pass_expires_at || '',
    moscow_pass_zone: docsObj.moscow_pass_zone || 'МКАД (круглосуточный)',
    moscow_pass_number: docsObj.moscow_pass_number || '',
    tacho_skzi_expires_at: docsObj.tacho_skzi_expires_at || '',
    tacho_calibration_expires_at: docsObj.tacho_calibration_expires_at || '',
    tacho_model: docsObj.tacho_model || '',
    oil_last_date: docsObj.oil_last_date || '',
    oil_last_km:
      typeof docsObj.oil_last_km === 'number'
        ? docsObj.oil_last_km
        : parseInt(docsObj.oil_last_km) || 0,
    oil_interval_km:
      typeof docsObj.oil_interval_km === 'number'
        ? docsObj.oil_interval_km
        : parseInt(docsObj.oil_interval_km) || 10000,
    fire_extinguisher_expires_at: docsObj.fire_extinguisher_expires_at || '',
  };
}

import { calcOrderLoaderMetrics } from '@saldacargo/shared';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'current_month';
    const { months: periodMonths } = getPeriodRange(period);

    const supabase = createAdminClient();

    // Months range: past 5 months up to current
    const now = new Date();
    const monthsList: Array<{
      id: string;
      label: string;
      short: string;
      year: number;
      month: number;
    }> = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
      const year = d.getUTCFullYear();
      const monthNum = d.getUTCMonth() + 1;
      const id = `${year}-${String(monthNum).padStart(2, '0')}`;
      const short = d.toLocaleDateString('ru-RU', { month: 'short', timeZone: 'UTC' });
      const rawMonth = d.toLocaleDateString('ru-RU', { month: 'long', timeZone: 'UTC' });
      const capitalized = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
      monthsList.push({
        id,
        label: `${capitalized} ${year}`,
        short: short.charAt(0).toUpperCase() + short.slice(1),
        year,
        month: monthNum,
      });
    }

    const firstMonth = monthsList[0];
    const multiMonthsStart = firstMonth
      ? new Date(Date.UTC(firstMonth.year, firstMonth.month - 1, 1)).toISOString()
      : new Date().toISOString();

    const [
      { data: assets, error: assetsError },
      { data: assetTypes },
      { data: allApprovedTrips },
      { data: allServiceOrders },
    ] = await Promise.all([
      // 1. Все машины
      (supabase as any)
        .from('assets')
        .select(
          `
          id, short_name, reg_number, year, status, odometer_current,
          current_book_value, remaining_depreciation_months,
          monthly_fixed_cost, insurance_expires_at, inspection_expires_at,
          needs_update, notes,
          asset_type:asset_types(id, code, name, capacity_m, has_gps),
          driver:users!assets_assigned_driver_id_fkey(id, name, is_active)
        `,
        )
        .not('status', 'in', '("sold","written_off")')
        .order('short_name'),

      // 2. Типы машин
      (supabase as any).from('asset_types').select('id, code, name').order('name'),

      // 3. Все утверждённые рейсы за последние 5 месяцев с заказами и расходами
      (supabase as any)
        .from('trips')
        .select(
          `
          id, trip_number, status, lifecycle_status, started_at, ended_at,
          odometer_start, odometer_end, asset_id,
          driver:users!trips_driver_id_fkey(id, name),
          loader:users!trips_loader_id_fkey(id, name),
          trip_orders(
            id, amount, driver_pay, loader_pay, loader2_pay,
            payment_method, settlement_status, lifecycle_status,
            counterparty:counterparties(name),
            direction, is_driver_loader, driver_car_pay, driver_loader_pay, loaders_data
          ),
          trip_expenses(
            id, amount, payment_method, description,
            category:transaction_categories(name)
          )
        `,
        )
        .eq('lifecycle_status', 'approved')
        .gte('started_at', multiMonthsStart)
        .order('started_at', { ascending: false }),

      // 4. Все заказ-наряды Гаража для своих машин за последние 5 месяцев
      (supabase as any)
        .from('service_orders')
        .select(
          `
          id, order_number, machine_type, status, lifecycle_status, created_at, updated_at,
          problem_description, admin_note, mechanic_note, mechanic_pay, second_mechanic_pay, asset_id,
          works:service_order_works(
            id, custom_work_name, status, salary_paid, price_client
          ),
          parts:service_order_parts(
            id, custom_part_name, quantity, unit_price
          )
        `,
        )
        .eq('machine_type', 'own')
        .eq('lifecycle_status', 'approved')
        .not('asset_id', 'is', null)
        .gte('created_at', multiMonthsStart)
        .order('created_at', { ascending: false }),
    ]);

    if (assetsError) return NextResponse.json({ error: assetsError.message }, { status: 500 });

    // ── Помесячная агрегация для каждого автомобиля ────────────────────────────
    const tripsByAsset = new Map<string, any[]>();
    for (const trip of (allApprovedTrips as any[]) ?? []) {
      if (!trip.asset_id) continue;
      const list = tripsByAsset.get(trip.asset_id) ?? [];
      list.push(trip);
      tripsByAsset.set(trip.asset_id, list);
    }

    const serviceOrdersByAsset = new Map<string, any[]>();
    for (const order of (allServiceOrders as any[]) ?? []) {
      if (!order.asset_id) continue;
      const list = serviceOrdersByAsset.get(order.asset_id) ?? [];
      list.push(order);
      serviceOrdersByAsset.set(order.asset_id, list);
    }

    const rows = ((assets as any[]) ?? []).map((asset: any) => {
      const assetTrips = tripsByAsset.get(asset.id) ?? [];
      const assetServiceOrders = serviceOrdersByAsset.get(asset.id) ?? [];

      const monthly: Record<
        string,
        {
          revenue: number;
          fuel: number;
          driverPay: number;
          loaderPay: number;
          loadingBilled: number;
          loaderProfit: number;
          loaderOrdersCount: number;
          maint: number;
          km: number;
          trips: number;
          profit: number;
          margin: number;
        }
      > = {};

      monthsList.forEach((m) => {
        monthly[m.id] = {
          revenue: 0,
          fuel: 0,
          driverPay: 0,
          loaderPay: 0,
          loadingBilled: 0,
          loaderProfit: 0,
          loaderOrdersCount: 0,
          maint: 0,
          km: 0,
          trips: 0,
          profit: 0,
          margin: 0,
        };
      });

      // Aggregate Trips by Month
      assetTrips.forEach((t) => {
        const dateKey = (t.started_at || '').slice(0, 7);
        if (!monthly[dateKey]) return;

        const activeOrders = (t.trip_orders || []).filter(
          (o: any) => o.lifecycle_status !== 'cancelled',
        );
        const expenses = t.trip_expenses || [];

        const rev = activeOrders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.amount) || 0),
          0,
        );
        const dPay = activeOrders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.driver_pay) || 0),
          0,
        );
        const lPay = activeOrders.reduce(
          (sum: number, o: any) =>
            sum + (parseFloat(o.loader_pay) || 0) + (parseFloat(o.loader2_pay) || 0),
          0,
        );

        let tripLoadingBilled = 0;
        let tripLoaderProfit = 0;
        let tripLoaderOrders = 0;

        activeOrders.forEach((o: any) => {
          const m = calcOrderLoaderMetrics(o, t.started_at);
          if (m.totalPaid > 0) {
            tripLoadingBilled += m.loadersPool;
            tripLoaderProfit += m.profit;
            tripLoaderOrders += 1;
          }
        });

        const fuel = expenses
          .filter(
            (e: any) =>
              e.category?.name === 'ГСМ' ||
              (e.description || '').toLowerCase().includes('гсм') ||
              (e.description || '').toLowerCase().includes('топливо') ||
              (e.description || '').toLowerCase().includes('заправ'),
          )
          .reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

        const mileage =
          t.odometer_end && t.odometer_start && t.odometer_end > t.odometer_start
            ? t.odometer_end - t.odometer_start
            : 0;

        monthly[dateKey].revenue += rev;
        monthly[dateKey].fuel += fuel;
        monthly[dateKey].driverPay += dPay;
        monthly[dateKey].loaderPay += lPay;
        monthly[dateKey].loadingBilled += tripLoadingBilled;
        monthly[dateKey].loaderProfit += tripLoaderProfit;
        monthly[dateKey].loaderOrdersCount += tripLoaderOrders;
        monthly[dateKey].km += mileage;
        monthly[dateKey].trips += 1;
      });

      // Aggregate Service Orders by Month
      assetServiceOrders.forEach((o) => {
        const dateKey = (o.created_at || '').slice(0, 7);
        if (!monthly[dateKey]) return;

        const parts = o.parts || [];
        const works = o.works || [];
        const desc = o.problem_description || '';
        const note = o.admin_note || '';

        const externalMatch =
          desc.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
          note.match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i);
        const isExternal = Boolean(externalMatch);

        const partsCost = parts.reduce(
          (sum: number, p: any) =>
            sum + (parseFloat(p.unit_price) || 0) * (parseFloat(p.quantity) || 1),
          0,
        );

        let worksCost = 0;
        if (isExternal) {
          worksCost = works.reduce(
            (sum: number, w: any) => sum + (parseFloat(w.price_client) || 0),
            0,
          );
        } else {
          const m1 = parseFloat(o.mechanic_pay) || 0;
          const m2 = parseFloat(o.second_mechanic_pay) || 0;
          worksCost = m1 + m2;
          if (worksCost <= 0) {
            worksCost = works.reduce(
              (sum: number, w: any) => sum + (parseFloat(w.price_client) || 0) * 0.5,
              0,
            );
          }
        }

        monthly[dateKey].maint += Math.round(partsCost + worksCost);
      });

      // Calculate profit & margin for each month
      monthsList.forEach((m) => {
        const item = monthly[m.id];
        if (item) {
          const costs = item.fuel + item.driverPay + item.loaderPay + item.maint;
          item.profit = item.revenue - costs;
          item.margin = item.revenue > 0 ? Math.round((item.profit / item.revenue) * 100) : 0;
        }
      });

      // Formatted recent trips for accordion detail
      const recentTrips = assetTrips.slice(0, 8).map((t) => {
        const activeOrders = (t.trip_orders || []).filter(
          (o: any) => o.lifecycle_status !== 'cancelled',
        );
        const expenses = t.trip_expenses || [];
        const rev = activeOrders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.amount) || 0),
          0,
        );
        const dPay = activeOrders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.driver_pay) || 0),
          0,
        );
        const lPay = activeOrders.reduce(
          (sum: number, o: any) =>
            sum + (parseFloat(o.loader_pay) || 0) + (parseFloat(o.loader2_pay) || 0),
          0,
        );
        const fuel = expenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
        const km =
          t.odometer_end && t.odometer_start && t.odometer_end > t.odometer_start
            ? t.odometer_end - t.odometer_start
            : 0;
        const profit = rev - (fuel + dPay + lPay);

        return {
          id: t.id,
          number: t.trip_number,
          date: t.started_at ? new Date(t.started_at).toLocaleDateString('ru-RU') : '—',
          driver: t.driver?.name || '—',
          loader: t.loader?.name || null,
          revenue: rev,
          fuel,
          driverPay: dPay,
          loaderPay: lPay,
          profit,
          km,
          orders: activeOrders.map((o: any) => {
            const pm = o.payment_method || 'cash';
            let label = '💵 Наличные';
            if (pm === 'qr') label = '⚡ QR-код';
            else if (pm === 'bank_invoice') label = '🏛️ Р/С Т-Банк';
            else if (pm === 'debt_cash') label = '⏳ Долг';
            else if (pm === 'fuel_card') label = '⛽ Карта';
            return {
              desc: (o.counterparty?.name || 'Заказ') + (o.direction ? ` · ${o.direction}` : ''),
              amount: parseFloat(o.amount) || 0,
              method: pm,
              label,
              status: o.lifecycle_status,
            };
          }),
        };
      });

      // Formatted recent service orders for accordion detail
      const recentServiceOrders = assetServiceOrders.slice(0, 5).map((o) => {
        const parts = o.parts || [];
        const works = o.works || [];
        const partsCost = parts.reduce(
          (sum: number, p: any) =>
            sum + (parseFloat(p.unit_price) || 0) * (parseFloat(p.quantity) || 1),
          0,
        );
        const externalMatch =
          (o.problem_description || '').match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i) ||
          (o.admin_note || '').match(/\[Сторонний сервис(?::\s*([^\]]+))?\]/i);
        const isExternal = Boolean(externalMatch);
        let contractor = 'Свой Гараж';
        if (externalMatch && externalMatch[1]) contractor = externalMatch[1].trim();
        else if (isExternal) contractor = 'Сторонний сервис';

        let worksCost = 0;
        if (isExternal) {
          worksCost = works.reduce(
            (sum: number, w: any) => sum + (parseFloat(w.price_client) || 0),
            0,
          );
        } else {
          worksCost = (parseFloat(o.mechanic_pay) || 0) + (parseFloat(o.second_mechanic_pay) || 0);
          if (worksCost <= 0)
            worksCost = works.reduce(
              (sum: number, w: any) => sum + (parseFloat(w.price_client) || 0) * 0.5,
              0,
            );
        }

        return {
          id: o.id,
          number: String(o.order_number),
          date: o.created_at ? new Date(o.created_at).toLocaleDateString('ru-RU') : '—',
          desc: o.problem_description || 'Техническое обслуживание',
          parts: Math.round(partsCost),
          works: Math.round(worksCost),
          isExternal,
          contractor,
        };
      });

      // Backward compatible single-period analytics
      const currentMonthKey = monthsList[monthsList.length - 1]?.id ?? '';
      const curData = (currentMonthKey ? monthly[currentMonthKey] : null) || {
        revenue: 0,
        fuel: 0,
        driverPay: 0,
        loaderPay: 0,
        maint: 0,
        km: 0,
        trips: 0,
        profit: 0,
        margin: 0,
      };
      const operCosts = curData.fuel + curData.driverPay + curData.loaderPay;
      const fixedCost = parseFloat(asset.monthly_fixed_cost ?? '0') * periodMonths;
      const totalCosts = operCosts + curData.maint + fixedCost;

      const docs = parseVehicleDocs(
        asset.notes,
        asset.insurance_expires_at,
        asset.inspection_expires_at,
      );

      const activeDriver = asset.driver?.is_active
        ? { id: asset.driver.id, name: asset.driver.name }
        : null;

      return {
        ...asset,
        driver: activeDriver,
        docs,
        monthly,
        trips: recentTrips,
        serviceOrders: recentServiceOrders,
        analytics: {
          revenue: curData.revenue.toFixed(2),
          expenses: operCosts.toFixed(2),
          maintenance: curData.maint.toFixed(2),
          fixed_cost: fixedCost.toFixed(2),
          total_costs: totalCosts.toFixed(2),
          profit: (curData.revenue - operCosts).toFixed(2),
          true_profit: (curData.revenue - totalCosts).toFixed(2),
          km: curData.km,
          trip_count: curData.trips,
          order_count: curData.trips,
          avg_order_value: curData.trips > 0 ? (curData.revenue / curData.trips).toFixed(2) : null,
          avg_km_per_trip: curData.trips > 0 ? Math.round(curData.km / curData.trips) : null,
          cost_per_km: curData.km > 0 ? (operCosts / curData.km).toFixed(2) : null,
          true_cost_per_km: curData.km > 0 ? (totalCosts / curData.km).toFixed(2) : null,
          margin_pct:
            curData.revenue > 0
              ? Math.round(((curData.revenue - totalCosts) / curData.revenue) * 100)
              : null,
        },
      };
    });

    const summary = {
      total: rows.length,
      active: rows.filter((a: any) => a.status === 'active').length,
      repair: rows.filter((a: any) => a.status === 'repair').length,
      reserve: rows.filter((a: any) => a.status === 'reserve').length,
      needsUpdate: rows.filter((a: any) => a.needs_update).length,
    };

    return NextResponse.json({
      assets: rows,
      months: monthsList,
      summary,
      assetTypes,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const supabase = createAdminClient();

    let notesVal = body.notes ?? null;
    if (body.docs && typeof body.docs === 'object') {
      const cleanUserNote = (body.notes || '').replace(/\[DOCS_DATA:.*?\]/s, '').trim();
      notesVal = cleanUserNote
        ? `${cleanUserNote}\n[DOCS_DATA:${JSON.stringify(body.docs)}]`
        : `[DOCS_DATA:${JSON.stringify(body.docs)}]`;
    }

    const payload: Record<string, any> = {
      short_name: body.short_name?.trim(),
      reg_number: body.reg_number?.trim(),
      asset_type_id: body.asset_type_id,
      year: body.year ?? null,
      status: body.status ?? 'active',
      odometer_current: body.odometer_current ?? 0,
      assigned_driver_id: body.assigned_driver_id ?? null,
      current_book_value: body.current_book_value ?? '0.00',
      remaining_depreciation_months: body.remaining_depreciation_months ?? null,
      monthly_fixed_cost: body.monthly_fixed_cost ?? '0.00',
      insurance_expires_at: body.insurance_expires_at || body.docs?.insurance_expires_at || null,
      inspection_expires_at: body.inspection_expires_at || body.docs?.inspection_expires_at || null,
      notes: notesVal,
      needs_update: false,
    };

    if (!payload.short_name || !payload.reg_number || !payload.asset_type_id) {
      return NextResponse.json(
        { error: 'short_name, reg_number, asset_type_id — обязательны' },
        { status: 400 },
      );
    }

    const { data, error } = await (supabase.from('assets') as any)
      .insert(payload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
