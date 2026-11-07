/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchTripWialonMileage } from '@saldacargo/domain-service';
import { syncTripFinancials } from '@/lib/tripFinancials';
import { cookies } from 'next/headers';

/**
 * GET /api/trips/:id/wialon-telematics
 * Опрос телеметрии Wialon по конкретному рейсу и проверка на расхождения одометра.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: trip, error } = await supabase
      .from('trips')
      .select(
        'id, trip_number, started_at, ended_at, odometer_start, odometer_end, admin_note, driver_note, asset:assets(id, reg_number, short_name)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error || !trip) {
      return NextResponse.json({ error: error?.message || 'Рейс не найден' }, { status: 404 });
    }

    const asset = Array.isArray(trip.asset) ? trip.asset[0] : trip.asset;
    if (!asset?.reg_number) {
      return NextResponse.json(
        { error: 'У автомобиля нет госномера для связи с Wialon' },
        { status: 400 },
      );
    }

    const telemetry = await fetchTripWialonMileage({
      regNumber: asset.reg_number,
      startedAt: trip.started_at,
      endedAt: trip.ended_at,
    });

    if (!telemetry) {
      return NextResponse.json({
        success: false,
        message: `Для ТС ${asset.reg_number} не найдены телематические сообщения Wialon за указанный период`,
      });
    }

    const enteredKm = Math.max(0, (trip.odometer_end || 0) - (trip.odometer_start || 0));
    const diffKm = Math.abs(enteredKm - telemetry.wialonKm);
    const hasDiscrepancy = diffKm > 5;

    return NextResponse.json({
      success: true,
      telemetry,
      enteredKm,
      diffKm,
      hasDiscrepancy,
      sign: enteredKm > telemetry.wialonKm ? '+' : '-',
    });
  } catch (err: any) {
    console.error('Ошибка получения телеметрии Wialon:', err);
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}

/**
 * POST /api/trips/:id/wialon-telematics
 * Автоматическое применение пробега Wialon к рейсу:
 * - Корректирует одометры рейса (start/end)
 * - Пересчитывает зарплату водителя (10 ₽/км + 1000 ₽/день)
 * - Пересчитывает норматив ГСМ (18 л / 100 км по 82 ₽/л)
 * - Обновляет admin_note рейса с метаданными WIALON_AUDIT
 * - Синхронизирует финансовые транзакции через syncTripFinancials
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select(
        'id, trip_number, started_at, ended_at, odometer_start, odometer_end, admin_note, driver_note, asset:assets(id, reg_number, short_name)',
      )
      .eq('id', id)
      .maybeSingle();

    if (tripErr || !trip) {
      return NextResponse.json({ error: tripErr?.message || 'Рейс не найден' }, { status: 404 });
    }

    const asset = Array.isArray(trip.asset) ? trip.asset[0] : trip.asset;
    const body = (await req.json().catch(() => ({}))) as Partial<{
      wialonKm: number;
      startOdo: number;
      endOdo: number;
      normLiters: number;
      normCost: number;
      driverPay: number;
      daysCount: number;
    }>;

    let telemetryData =
      body.wialonKm && body.startOdo && body.endOdo
        ? {
            wialonKm: body.wialonKm,
            startOdo: body.startOdo,
            endOdo: body.endOdo,
            normLiters: body.normLiters || Number(((body.wialonKm * 18) / 100).toFixed(1)),
            normCost:
              body.normCost !== undefined
                ? Math.round(body.normCost / 100) * 100
                : Math.round((Number(((body.wialonKm * 18) / 100).toFixed(1)) * 82) / 100) * 100,
            driverPay:
              body.driverPay !== undefined
                ? Math.floor(body.driverPay / 100) * 100
                : Math.floor((body.wialonKm * 10 + (body.daysCount || 1) * 1000) / 100) * 100,
            daysCount: body.daysCount || 1,
          }
        : null;

    if (!telemetryData) {
      if (!asset?.reg_number) {
        return NextResponse.json({ error: 'У автомобиля нет госномера' }, { status: 400 });
      }

      const fetched = await fetchTripWialonMileage({
        regNumber: asset.reg_number,
        startedAt: trip.started_at,
        endedAt: trip.ended_at,
      });

      if (!fetched) {
        return NextResponse.json(
          { error: 'Не удалось получить телеметрию из Wialon' },
          { status: 400 },
        );
      }

      telemetryData = {
        wialonKm: fetched.wialonKm,
        startOdo: fetched.startOdo,
        endOdo: fetched.endOdo,
        normLiters: fetched.normLiters,
        normCost: fetched.normCost,
        driverPay: fetched.driverPay,
        daysCount: fetched.daysCount,
      };
    }

    const { wialonKm, startOdo, endOdo, normLiters, normCost, driverPay, daysCount } =
      telemetryData;
    const kmPay = wialonKm * 10;
    const perDiemPay = daysCount * 1000;

    // 1. Формируем актуальный admin_note с тегом WIALON_AUDIT
    const auditMeta = {
      wialon_km: wialonKm,
      odo_start: startOdo,
      odo_end: endOdo,
      norm_liters: normLiters,
      norm_cost: normCost,
      fuel_rate: 18,
      fuel_price: 82,
      driver_pay: driverPay,
      diff_km: 0,
      has_discrepancy: false,
      synced_at: new Date().toISOString(),
    };

    const cleanPrevAdminNote = (trip.admin_note || '')
      .replace(/\[WIALON_AUDIT:\{.*?\}\]/g, '')
      .replace(/Пробег по Wialon:.*?Одометры Wialon:.*?(?:\||$)/g, '')
      .trim();

    const newAdminNote = `Пробег по Wialon: ${wialonKm} км (${kmPay} ₽) + Суточные: ${daysCount} дн (${perDiemPay} ₽) = Итого ЗП: ${driverPay} ₽ | Норматив ГСМ: ${normLiters} л (18л/100км @ 82₽/л = ${normCost} ₽) | Одометры Wialon: ${startOdo} → ${endOdo} км [WIALON_AUDIT:${JSON.stringify(auditMeta)}]${cleanPrevAdminNote ? ` | ${cleanPrevAdminNote}` : ''}`;

    // 2. Обновляем рейс
    const { error: updTripErr } = await (supabase.from('trips') as any)
      .update({
        odometer_start: startOdo,
        odometer_end: endOdo,
        admin_note: newAdminNote,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updTripErr) {
      return NextResponse.json(
        { error: `Ошибка обновления рейса: ${updTripErr.message}` },
        { status: 500 },
      );
    }

    // 3. Обновляем одометр актива
    if (asset?.id) {
      await (supabase.from('assets') as any)
        .update({ odometer_current: endOdo, updated_at: new Date().toISOString() })
        .eq('id', asset.id);
    }

    // 4. Обновляем зарплату водителя в trip_orders
    const { data: orders } = await (supabase.from('trip_orders') as any)
      .select('id, driver_pay, description')
      .eq('trip_id', id)
      .neq('lifecycle_status', 'cancelled');

    if (orders && orders.length > 0) {
      if (orders.length === 1) {
        const singleOrder = orders[0];
        let desc = singleOrder.description || '';
        if (desc.includes('км')) {
          desc = desc.replace(/\(\d+\s*км\)/, `(${wialonKm} км)`);
        }
        await (supabase.from('trip_orders') as any)
          .update({
            driver_pay: driverPay.toFixed(2),
            description: desc || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', singleOrder.id);
      } else {
        // Если несколько заявок, пропорционально распределяем ЗП
        const payPerOrder = Math.round(driverPay / orders.length);
        for (let i = 0; i < orders.length; i++) {
          const isLast = i === orders.length - 1;
          const assignedPay = isLast ? driverPay - payPerOrder * (orders.length - 1) : payPerOrder;
          await (supabase.from('trip_orders') as any)
            .update({
              driver_pay: assignedPay.toFixed(2),
              updated_at: new Date().toISOString(),
            })
            .eq('id', orders[i].id);
        }
      }
    }

    // 5. Обновляем или добавляем нормативный расход топлива в trip_expenses
    const CAT_FUEL_ID = '62cebf3f-9982-4cc6-904b-48c6169cf5e4';
    const { data: existingExpenses } = await (supabase.from('trip_expenses') as any)
      .select('id, description, amount')
      .eq('trip_id', id);

    const fuelExp =
      (existingExpenses || []).find((e: any) => {
        const d = (e.description || '').toLowerCase();
        return (
          d.includes('топливо') ||
          d.includes('гсм') ||
          d.includes('норматив') ||
          d.includes('дизел')
        );
      }) || existingExpenses?.[0];

    const fuelDesc = `Топливо по нормативу (Валдай): ${normLiters} л (18л/100км @ 82₽/л)`;

    if (fuelExp) {
      await (supabase.from('trip_expenses') as any)
        .update({
          amount: normCost.toFixed(2),
          description: fuelDesc,
          updated_at: new Date().toISOString(),
        })
        .eq('id', fuelExp.id);
    } else {
      await (supabase.from('trip_expenses') as any).insert({
        trip_id: id,
        category_id: CAT_FUEL_ID,
        amount: normCost.toFixed(2),
        payment_method: 'fuel_card',
        description: fuelDesc,
        idempotency_key: crypto.randomUUID(),
      });
    }

    // 6. Синхронизируем финансовые транзакции
    const cookieStore = await cookies();
    const adminId = cookieStore.get('salda_auth_token')?.value ?? null;
    await syncTripFinancials(supabase, id, adminId);

    return NextResponse.json({
      success: true,
      message: `Пробег Wialon (${wialonKm} км) успешно применен к рейсу №${trip.trip_number}`,
      wialonKm,
      driverPay,
      normLiters,
      normCost,
      startOdo,
      endOdo,
    });
  } catch (err: any) {
    console.error('Ошибка применения телеметрии Wialon:', err);
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}
