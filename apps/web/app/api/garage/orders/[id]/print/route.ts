/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order, error } = await (supabase.from('service_orders') as any)
    .select(
      `
      id, order_number, created_at, machine_type,
      problem_description, admin_note, mechanic_note,
      odometer_start, odometer_end,
      client_name, client_phone, client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
      asset:assets(short_name, reg_number),
      mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
      second_mechanic:users!service_orders_second_mechanic_id_fkey(name),
      works:service_order_works(
        id, status, quantity, norm_minutes, actual_minutes, price_client, work_description, custom_work_name,
        work_catalog:work_catalog(name)
      ),
      parts:service_order_parts(
        id, quantity, unit_price,
        part:parts(name, unit)
      )
    `,
    )
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: sto } = await (supabase.from('sto_settings') as any)
    .select('hourly_rate, hourly_rate_own, company_name, company_address, company_phone')
    .limit(1)
    .maybeSingle();

  const isOwn = order.machine_type === 'own';
  const hourlyRate = parseFloat(
    isOwn ? (sto?.hourly_rate_own ?? '1600') : (sto?.hourly_rate ?? '2000'),
  );
  // These fields exist after migration 20260520000002; fallback to defaults if not yet applied
  const companyName = (sto as any)?.company_name ?? 'СТО СалдаКарго';
  const companyAddress = (sto as any)?.company_address ?? 'г. Верхняя Салда';
  const companyPhone = (sto as any)?.company_phone ?? '';

  const vehicle = isOwn
    ? `${order.asset?.short_name ?? ''} (${order.asset?.reg_number ?? ''})`
    : [order.client_vehicle_brand, order.client_vehicle_model, order.client_vehicle_reg]
        .filter(Boolean)
        .join(' ');

  const mechanics = [order.mechanic?.name, order.second_mechanic?.name].filter(Boolean).join(', ');

  const works: any[] = order.works ?? [];
  const parts: any[] = order.parts ?? [];

  const worksTotal = works.reduce((s: number, w: any) => s + parseFloat(w.price_client ?? '0'), 0);
  const partsTotal = parts.reduce(
    (s: number, p: any) => s + parseFloat(p.unit_price ?? '0') * p.quantity,
    0,
  );
  const grandTotal = worksTotal + partsTotal;

  const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const worksRows = works
    .map((w: any, i: number) => {
      const name = w.work_catalog?.name ?? w.custom_work_name ?? '—';
      const desc = w.work_description ?? '';
      const qty: number = w.quantity ?? 1;
      // actual_minutes is total for all units; norm is per-unit
      const minutes = w.actual_minutes ?? (w.norm_minutes ?? 0) * qty;
      const hours = (minutes / 60).toFixed(2);
      const price = parseFloat(w.price_client ?? '0');
      const status = w.status === 'completed' ? '✓' : '—';
      return `<tr>
        <td class="center">${i + 1}</td>
        <td>
          <div class="bold">${name}</div>
          ${desc ? `<div class="muted">${desc}</div>` : ''}
        </td>
        <td class="center">${qty}</td>
        <td class="center">${hours} н/ч</td>
        <td class="right">${hourlyRate.toLocaleString('ru-RU')}</td>
        <td class="right bold">${price > 0 ? price.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
        <td class="center">${status}</td>
      </tr>`;
    })
    .join('');

  const partsRows = parts
    .map((p: any, i: number) => {
      const total = parseFloat(p.unit_price ?? '0') * p.quantity;
      return `<tr>
        <td class="center">${i + 1}</td>
        <td>${p.part?.name ?? '—'}</td>
        <td class="center">${p.quantity}</td>
        <td class="center">${p.part?.unit ?? 'шт'}</td>
        <td class="right">${parseFloat(p.unit_price ?? '0').toLocaleString('ru-RU')}</td>
        <td class="right bold">${total > 0 ? total.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
        <td></td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Заказ-наряд НЗ-${order.order_number}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.4; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
  .company-name { font-size: 16px; font-weight: 700; }
  .company-sub { font-size: 10px; color: #555; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 18px; font-weight: 700; }
  .doc-title .doc-num { font-size: 12px; color: #333; margin-top: 2px; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; background: #fafafa; }
  .info-row { display: flex; gap: 6px; align-items: baseline; }
  .info-label { font-size: 10px; color: #888; white-space: nowrap; min-width: 90px; }
  .info-value { font-size: 11px; font-weight: 600; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #1e293b; color: #fff; padding: 5px 6px; font-size: 10px; font-weight: 600; text-align: left; }
  td { padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .section-title { font-size: 12px; font-weight: 700; color: #1e293b; margin: 14px 0 6px; border-left: 3px solid #1e293b; padding-left: 8px; }
  .muted { color: #666; font-size: 10px; margin-top: 2px; }
  .bold { font-weight: 600; }
  .center { text-align: center; }
  .right { text-align: right; }

  /* Totals */
  .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .totals-table { width: 260px; }
  .totals-table td { border: none; padding: 3px 6px; }
  .totals-table .grand { font-size: 13px; font-weight: 700; border-top: 2px solid #111; padding-top: 5px; }

  /* Notes */
  .note-box { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; background: #fffbf0; }
  .note-box .note-label { font-size: 10px; color: #888; margin-bottom: 3px; }

  /* Signatures */
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #555; }

  @media print { .no-print { display: none; } }
</style>
</head>
<body>

<div class="no-print" style="background:#1e293b;color:#fff;padding:10px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;border-radius:6px">
  <span style="font-size:13px;font-weight:600">Предпросмотр заказ-наряда НЗ-${order.order_number}</span>
  <button onclick="window.print()" style="background:#fff;color:#1e293b;border:none;padding:6px 16px;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">🖨 Печать / PDF</button>
</div>

<!-- Header -->
<div class="header">
  <div>
    <div class="company-name">${companyName}</div>
    <div class="company-sub">${companyAddress}${companyPhone ? ' · ' + companyPhone : ''}</div>
  </div>
  <div class="doc-title">
    <h1>ЗАКАЗ-НАРЯД</h1>
    <div class="doc-num">НЗ-${order.order_number} &nbsp;от&nbsp; ${date}</div>
  </div>
</div>

<!-- Info -->
<div class="info-grid">
  <div class="info-row"><span class="info-label">Транспортное средство:</span><span class="info-value">${vehicle || '—'}</span></div>
  <div class="info-row"><span class="info-label">Заказчик:</span><span class="info-value">${order.client_name || (isOwn ? 'Собственный ТС' : '—')}</span></div>
  <div class="info-row"><span class="info-label">Одометр (вход/выход):</span><span class="info-value">${order.odometer_start ? order.odometer_start.toLocaleString('ru-RU') + ' км' : '—'}${order.odometer_end ? ' → ' + order.odometer_end.toLocaleString('ru-RU') + ' км' : ''}</span></div>
  <div class="info-row"><span class="info-label">Телефон:</span><span class="info-value">${order.client_phone || '—'}</span></div>
  <div class="info-row"><span class="info-label">Исполнитель(и):</span><span class="info-value">${mechanics || '—'}</span></div>
  <div class="info-row"><span class="info-label">Ставка нормачаса:</span><span class="info-value">${hourlyRate.toLocaleString('ru-RU')} ₽/н·ч</span></div>
</div>

<!-- Works -->
<div class="section-title">Выполненные работы</div>
<table>
  <thead><tr>
    <th style="width:28px">№</th>
    <th>Наименование работы / Описание</th>
    <th class="center" style="width:40px">Кол-во</th>
    <th class="center" style="width:56px">Н/ч всего</th>
    <th class="right" style="width:70px">Ставка</th>
    <th class="right" style="width:80px">Сумма</th>
    <th class="center" style="width:28px">Вып.</th>
  </tr></thead>
  <tbody>${worksRows || '<tr><td colspan="7" style="color:#aaa;font-style:italic;text-align:center;padding:12px">Работы не указаны</td></tr>'}</tbody>
</table>

${
  parts.length > 0
    ? `<div class="section-title">Запасные части и материалы</div>
<table>
  <thead><tr>
    <th style="width:28px">№</th>
    <th>Наименование</th>
    <th class="center" style="width:50px">Кол-во</th>
    <th class="center" style="width:36px">Ед.</th>
    <th class="right" style="width:80px">Цена</th>
    <th class="right" style="width:80px">Сумма</th>
    <th style="width:28px"></th>
  </tr></thead>
  <tbody>${partsRows}</tbody>
</table>`
    : ''
}

<!-- Totals -->
<div class="totals">
  <table class="totals-table">
    <tr><td>Работы:</td><td class="right bold">${worksTotal.toLocaleString('ru-RU')} ₽</td></tr>
    ${partsTotal > 0 ? `<tr><td>Запчасти:</td><td class="right bold">${partsTotal.toLocaleString('ru-RU')} ₽</td></tr>` : ''}
    <tr><td class="grand">ИТОГО:</td><td class="right grand">${grandTotal.toLocaleString('ru-RU')} ₽</td></tr>
  </table>
</div>

${order.problem_description ? `<div class="note-box"><div class="note-label">Описание проблемы (со слов клиента):</div>${order.problem_description}</div>` : ''}
${order.mechanic_note ? `<div class="note-box"><div class="note-label">Заметка исполнителя:</div>${order.mechanic_note}</div>` : ''}
${order.admin_note ? `<div class="note-box"><div class="note-label">Примечание администратора:</div>${order.admin_note}</div>` : ''}

<!-- Signatures -->
<div class="signatures">
  <div>
    <div class="sig-line">Подпись заказчика: _______________________</div>
    <div style="font-size:10px;color:#888;margin-top:2px">${order.client_name || '&nbsp;'}</div>
  </div>
  <div>
    <div class="sig-line">Подпись мастера: ________________________</div>
    <div style="font-size:10px;color:#888;margin-top:2px">${mechanics || '&nbsp;'}</div>
  </div>
</div>

</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
