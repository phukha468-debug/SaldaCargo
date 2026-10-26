/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

/** GET /api/admin/service-orders?filter=review|active|history&date=YYYY-MM-DD */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') ?? 'review';
  const date = searchParams.get('date');

  try {
    const supabase = createAdminClient();

    const [{ data: sto }] = await Promise.all([
      (supabase.from('sto_settings') as any)
        .select('hourly_rate, hourly_rate_own')
        .limit(1)
        .maybeSingle(),
    ]);

    const rateClient = parseFloat(sto?.hourly_rate ?? '2000') || 2000;
    const rateOwn = parseFloat(sto?.hourly_rate_own ?? '1600') || 1600;

    const selectStr = `
      id, order_number, machine_type, status, lifecycle_status, priority, payment_received,
      problem_description, mechanic_note, admin_note, created_at, updated_at,
      mechanic_pay, second_mechanic_pay, odometer_start, odometer_end,
      asset_id, asset:assets(id, short_name, reg_number, odometer_current),
      assigned_mechanic_id, mechanic:users!service_orders_assigned_mechanic_id_fkey(id, name, mechanic_salary_pct),
      second_mechanic_id, second_mechanic:users!service_orders_second_mechanic_id_fkey(id, name, mechanic_salary_pct),
      client_vehicle_id, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
      client_name, client_phone,
      works:service_order_works(
        id, custom_work_name, work_description, status, salary_paid, actual_minutes, price_client, norm_minutes, quantity, mechanic_id, second_mechanic_id,
        work_catalog:work_catalog(id, name, norm_minutes)
      ),
      parts:service_order_parts(
        id, custom_part_name, quantity, unit_price, client_price, unit,
        part:parts(id, name, unit)
      )
    `;

    let q = (supabase.from('service_orders') as any)
      .select(selectStr)
      .order('created_at', { ascending: false })
      .limit(150);

    if (filter === 'review') {
      q = q.eq('status', 'completed').eq('lifecycle_status', 'draft');
    } else if (filter === 'active') {
      q = q.in('status', ['created', 'in_progress']).neq('lifecycle_status', 'cancelled');
    } else if (filter === 'history') {
      q = q.neq('lifecycle_status', 'cancelled');
      if (date) {
        q = q.gte('created_at', `${date}T00:00:00Z`).lte('created_at', `${date}T23:59:59Z`);
      } else {
        q = q.eq('lifecycle_status', 'approved');
      }
    }

    const { data: rawOrders, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orders = rawOrders ?? [];
    const orderIds = orders.map((o: any) => o.id);

    // Подтягиваем транзакции ЗП механиков по этим нарядам
    const txByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: txs } = await (supabase.from('transactions') as any)
        .select('service_order_id, amount, lifecycle_status, from_wallet_id')
        .in('service_order_id', orderIds)
        .eq('direction', 'expense')
        .neq('lifecycle_status', 'cancelled')
        .is('from_wallet_id', null);

      for (const t of txs ?? []) {
        if (!t.service_order_id) continue;
        txByOrder.set(
          t.service_order_id,
          (txByOrder.get(t.service_order_id) ?? 0) + (parseFloat(t.amount ?? '0') || 0),
        );
      }
    }

    const enriched = orders.map((o: any) => {
      const isOwn = o.machine_type === 'own';
      const hourlyRate = isOwn ? rateOwn : rateClient;
      const pct =
        o.mechanic?.mechanic_salary_pct != null && !isNaN(Number(o.mechanic.mechanic_salary_pct))
          ? Number(o.mechanic.mechanic_salary_pct)
          : 50;

      const activeWorks = (o.works ?? []).filter((w: any) => w.status !== 'cancelled');
      let totalMinutes = 0;
      let worksClientSum = 0;
      let estimatedPay = 0;

      for (const w of activeWorks) {
        const qty = Math.max(1, Number(w.quantity ?? 1));
        const mins = Number(w.actual_minutes || w.norm_minutes || 0) * qty;
        totalMinutes += mins;

        const explicitPrice = parseFloat(w.price_client ?? '0');
        const workPrice = explicitPrice > 0 ? explicitPrice : (mins / 60) * hourlyRate;
        worksClientSum += workPrice;
        estimatedPay += (workPrice * pct) / 100;
      }

      const partsSum = (o.parts ?? []).reduce(
        (s: number, p: any) =>
          s +
          (parseFloat(p.client_price ?? p.unit_price ?? '0') || 0) *
            (parseFloat(p.quantity ?? '1') || 1),
        0,
      );

      const txPay = txByOrder.get(o.id) ?? 0;
      const storedPay = parseFloat(o.mechanic_pay ?? '0') || 0;
      const effectivePay = txPay > 0 ? txPay : storedPay > 0 ? storedPay : estimatedPay;

      const partsFromService =
        (o.parts ?? []).length > 0 ||
        Boolean(o.mechanic_note && o.mechanic_note.includes('[Запчасти предоставил автосервис]'));

      return {
        ...o,
        hourly_rate: hourlyRate,
        salary_pct: pct,
        total_minutes: totalMinutes,
        works_total: worksClientSum.toFixed(2),
        parts_total: partsSum.toFixed(2),
        order_total: (worksClientSum + partsSum).toFixed(2),
        estimated_pay: estimatedPay.toFixed(2),
        mechanic_pay: effectivePay.toFixed(2),
        parts_provided_by_service: partsFromService,
      };
    });

    return NextResponse.json(enriched);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Ошибка сервера' }, { status: 500 });
  }
}
