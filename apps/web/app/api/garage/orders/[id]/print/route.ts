/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const doc = searchParams.get('doc') ?? 'works'; // 'works' | 'parts'

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
        id, quantity, unit_price, custom_part_name, unit,
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

  const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const baseStyles = `
  @page { size: A4; margin: 22mm 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; line-height: 1.4; max-width: 780px; margin: 0 auto; padding: 24px 28px; }
  @media print { body { padding: 0; max-width: none; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
  .company-name { font-size: 16px; font-weight: 700; }
  .company-sub { font-size: 10px; color: #555; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 18px; font-weight: 700; }
  .doc-title .doc-num { font-size: 12px; color: #333; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; background: #fafafa; }
  .info-row { display: flex; gap: 6px; align-items: baseline; }
  .info-label { font-size: 10px; color: #888; white-space: nowrap; min-width: 90px; }
  .info-value { font-size: 11px; font-weight: 600; }
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
  .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  .totals-table { width: 260px; }
  .totals-table td { border: none; padding: 3px 6px; }
  .totals-table .grand { font-size: 13px; font-weight: 700; border-top: 2px solid #111; padding-top: 5px; }
  .note-box { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; margin-bottom: 10px; background: #fffbf0; }
  .note-box .note-label { font-size: 10px; color: #888; margin-bottom: 3px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #555; }
  @media print { .no-print { display: none; } }`;

  const headerHtml = (title: string, subtitle: string) => `
<div class="no-print" style="background:#1e293b;color:#fff;padding:10px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;border-radius:6px">
  <span style="font-size:13px;font-weight:600">${subtitle} НЗ-${order.order_number}</span>
  <button onclick="window.print()" style="background:#fff;color:#1e293b;border:none;padding:6px 16px;border-radius:4px;font-weight:700;cursor:pointer;font-size:12px">🖨 Печать / PDF</button>
</div>
<div class="header">
  <div>
    <div class="company-name">${companyName}</div>
    <div class="company-sub">${companyAddress}${companyPhone ? ' · ' + companyPhone : ''}</div>
  </div>
  <div class="doc-title">
    <h1>${title}</h1>
    <div class="doc-num">НЗ-${order.order_number} &nbsp;от&nbsp; ${date}</div>
  </div>
</div>
<div class="info-grid">
  <div class="info-row"><span class="info-label">Транспортное средство:</span><span class="info-value">${vehicle || '—'}</span></div>
  <div class="info-row"><span class="info-label">Заказчик:</span><span class="info-value">${order.client_name || (isOwn ? 'Собственный ТС' : '—')}</span></div>
  <div class="info-row"><span class="info-label">Одометр (вход/выход):</span><span class="info-value">${order.odometer_start ? order.odometer_start.toLocaleString('ru-RU') + ' км' : '—'}${order.odometer_end ? ' → ' + order.odometer_end.toLocaleString('ru-RU') + ' км' : ''}</span></div>
  <div class="info-row"><span class="info-label">Телефон:</span><span class="info-value">${order.client_phone || '—'}</span></div>
  <div class="info-row"><span class="info-label">Исполнитель(и):</span><span class="info-value">${mechanics || '—'}</span></div>
  <div class="info-row"><span class="info-label">Ставка нормачаса:</span><span class="info-value">${hourlyRate.toLocaleString('ru-RU')} ₽/н·ч</span></div>
</div>`;

  if (doc === 'parts') {
    // Документ только для запчастей — внутренний, для закупки у поставщиков
    const partsRows = parts
      .map((p: any, i: number) => {
        const partName = p.part?.name ?? p.custom_part_name ?? '—';
        const partUnit = p.part?.unit ?? p.unit ?? 'шт';
        const unitPrice = parseFloat(p.unit_price ?? '0');
        const total = unitPrice * p.quantity;
        return `<tr>
        <td class="center">${i + 1}</td>
        <td>${partName}</td>
        <td class="center">${p.quantity}</td>
        <td class="center">${partUnit}</td>
        <td class="right">${unitPrice > 0 ? unitPrice.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
        <td class="right bold">${total > 0 ? total.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Запчасти НЗ-${order.order_number}</title>
<style>${baseStyles}
  th { background: #7c3aed; }
</style>
</head>
<body>
${headerHtml('ПЕРЕЧЕНЬ ЗАПЧАСТЕЙ', 'Запчасти')}
<div class="section-title">Запасные части и материалы</div>
<table>
  <thead><tr>
    <th style="width:28px">№</th>
    <th>Наименование запчасти / материала</th>
    <th class="center" style="width:50px">Кол-во</th>
    <th class="center" style="width:36px">Ед.</th>
    <th class="right" style="width:90px">Цена за ед.</th>
    <th class="right" style="width:90px">Сумма</th>
  </tr></thead>
  <tbody>${partsRows || '<tr><td colspan="6" style="color:#aaa;font-style:italic;text-align:center;padding:12px">Запчасти не указаны</td></tr>'}</tbody>
</table>
<div class="totals">
  <table class="totals-table">
    <tr><td class="grand">ИТОГО запчасти:</td><td class="right grand">${partsTotal.toLocaleString('ru-RU')} ₽</td></tr>
  </table>
</div>
${order.problem_description ? `<div class="note-box"><div class="note-label">Описание проблемы:</div>${order.problem_description}</div>` : ''}
<div class="signatures" style="margin-top:24px">
  <div>
    <div class="sig-line">Выдал запчасти: _______________________</div>
    <div style="font-size:10px;color:#888;margin-top:2px">&nbsp;</div>
  </div>
  <div>
    <div class="sig-line">Принял мастер: ________________________</div>
    <div style="font-size:10px;color:#888;margin-top:2px">${mechanics || '&nbsp;'}</div>
  </div>
</div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // doc === 'works' — основной заказ-наряд на работы (без цен на запчасти)
  const worksRows = works
    .map((w: any, i: number) => {
      const name = w.work_catalog?.name ?? w.custom_work_name ?? '—';
      const desc = w.work_description ?? '';
      const qty: number = w.quantity ?? 1;
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

  // В заказ-наряде на работы запчасти — только перечень без цен
  const partsListRows = parts
    .map((p: any, i: number) => {
      const partName = p.part?.name ?? p.custom_part_name ?? '—';
      const partUnit = p.part?.unit ?? p.unit ?? 'шт';
      return `<tr>
        <td class="center">${i + 1}</td>
        <td>${partName}</td>
        <td class="center">${p.quantity}</td>
        <td class="center">${partUnit}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8"/>
<title>Заказ-наряд НЗ-${order.order_number}</title>
<style>${baseStyles}</style>
</head>
<body>
${headerHtml('ЗАКАЗ-НАРЯД', 'Предпросмотр заказ-наряда')}

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
    ? `<div class="section-title">Использованные запасные части (перечень)</div>
<table>
  <thead><tr>
    <th style="width:28px">№</th>
    <th>Наименование</th>
    <th class="center" style="width:60px">Кол-во</th>
    <th class="center" style="width:40px">Ед.</th>
  </tr></thead>
  <tbody>${partsListRows}</tbody>
</table>`
    : ''
}

<div class="totals">
  <table class="totals-table">
    <tr><td>Работы:</td><td class="right bold">${worksTotal.toLocaleString('ru-RU')} ₽</td></tr>
    <tr><td class="grand">ИТОГО к оплате:</td><td class="right grand">${worksTotal.toLocaleString('ru-RU')} ₽</td></tr>
  </table>
</div>

${order.problem_description ? `<div class="note-box"><div class="note-label">Описание проблемы (со слов клиента):</div>${order.problem_description}</div>` : ''}
${order.mechanic_note ? `<div class="note-box"><div class="note-label">Заметка исполнителя:</div>${order.mechanic_note}</div>` : ''}
${order.admin_note ? `<div class="note-box"><div class="note-label">Примечание администратора:</div>${order.admin_note}</div>` : ''}

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
