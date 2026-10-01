/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const MAX_BOT_TOKEN =
  process.env.MAX_BOT_TOKEN ||
  'f9LHodD0cOKEmAc4Iy6Hq4JXmmVPVRpQ7vULw35IPAeFKQZMIpb1fSAwl5wl_mY1GcLcovMyJXcGngyIqypb';

// ID Александра Нигамедьянова в MAX Messenger
const ALEX_MAX_USER_ID = '76489387';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      comment?: string;
    };

    const supabase = createAdminClient();

    // 1. Загружаем полные данные наряда, включая работы и запчасти
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const cleanNum = id.replace(/[^0-9]/g, '');

    let query = (supabase as any).from('service_orders').select(
      `
        id, order_number, status, priority, machine_type,
        problem_description, admin_note, created_at,
        client_vehicle_brand, client_vehicle_model, client_vehicle_reg,
        client_name, client_phone,
        asset:assets(id, short_name, reg_number),
        mechanic:users!service_orders_assigned_mechanic_id_fkey(name),
        works:service_order_works(
          id, status, quantity, norm_minutes, price_client, custom_work_name,
          work_catalog:work_catalog(name, norm_minutes)
        ),
        parts:service_order_parts(
          id, quantity, custom_part_name, client_price, unit,
          part:parts(name, unit)
        )
      `,
    );

    if (isUuid) {
      query = query.eq('id', id);
    } else if (cleanNum) {
      query = query.or(`order_number.eq.${cleanNum},id.eq.${id}`);
    } else {
      query = query.eq('id', id);
    }

    const { data: order, error: orderErr } = await query.maybeSingle();

    if (orderErr) throw orderErr;
    if (!order) {
      return NextResponse.json({ error: 'Заказ-наряд не найден' }, { status: 404 });
    }

    // 2. Формируем текстовое описание автомобиля
    let vehicleText = 'Автомобиль не указан';
    if (order.machine_type === 'own' && order.asset) {
      vehicleText = `${order.asset.short_name || 'Автомобиль парка'}${
        order.asset.reg_number ? ` · ${order.asset.reg_number}` : ''
      }`;
    } else if (order.machine_type === 'client') {
      const brand = order.client_vehicle_brand || '';
      const model = order.client_vehicle_model || '';
      const reg = order.client_vehicle_reg || '';
      vehicleText = [brand, model].filter(Boolean).join(' ') || 'Клиентский автомобиль';
      if (reg) vehicleText += ` · ${reg}`;
    }

    const clientText = order.client_name
      ? `${order.client_name}${order.client_phone ? ` (${order.client_phone})` : ''}`
      : null;

    const mechanicName = (order.mechanic as any)?.name ?? null;

    // 3. Форматируем список работ
    const works = (order.works as any[]) ?? [];
    let worksList = 'Работы пока не добавлены';
    if (works.length > 0) {
      worksList = works
        .map((w, idx) => {
          const name = w.custom_work_name || w.work_catalog?.name || 'Работа без названия';
          const qty = w.quantity && w.quantity > 1 ? ` (кол-во: ${w.quantity})` : '';
          const normH = w.norm_minutes ? `${(w.norm_minutes / 60).toFixed(1)} нч` : 'нч не указаны';
          const price = w.price_client
            ? `${parseFloat(w.price_client).toLocaleString('ru-RU')} ₽`
            : 'цена не указана';
          return `${idx + 1}. ${name}${qty}\n   └ [${normH}] · ${price}`;
        })
        .join('\n');
    }

    // 4. Форматируем список запчастей (если есть)
    const parts = (order.parts as any[]) ?? [];
    let partsSection = '';
    if (parts.length > 0) {
      const partsLines = parts
        .map((p, idx) => {
          const name = p.custom_part_name || p.part?.name || 'Запчасть';
          const qty = `${p.quantity || 1} ${p.unit || p.part?.unit || 'шт'}`;
          const price = p.client_price
            ? ` · ${parseFloat(p.client_price).toLocaleString('ru-RU')} ₽`
            : '';
          return `   ${idx + 1}) ${name} (${qty}${price})`;
        })
        .join('\n');
      partsSection = `📦 ЗАПЧАСТИ В НАРЯДЕ (${parts.length}):\n${partsLines}\n\n`;
    }

    const createdDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('ru-RU');

    const baseUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.ancargo66.ru';
    const orderUrl = `${baseUrl}/garage?orderId=${order.id}`;

    // 5. Формируем итоговое сообщение для мессенджера MAX
    const messageLines = [
      `🛠️ СОГЛАСОВАНИЕ ЗАКАЗ-НАРЯДА №${order.order_number}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🚗 Автомобиль: ${vehicleText}`,
      `📅 Дата: ${createdDate}`,
      clientText ? `👤 Заказчик: ${clientText}` : null,
      mechanicName ? `🔧 Мастер/Исполнитель: ${mechanicName}` : null,
      ``,
      `📝 Неисправность / Описание:`,
      order.problem_description ? order.problem_description.trim() : 'Не указана',
      ``,
      `📋 СПИСОК РАБОТ (${works.length}):`,
      worksList,
      ``,
      partsSection ? partsSection.trim() : null,
      body.comment?.trim() ? `💬 Комментарий администратора:\n«${body.comment.trim()}»\n` : null,
      `❓ Александр, пожалуйста, определите норма-часы и согласуйте стоимость работ по данному наряду.`,
      ``,
      `🔗 Открыть заказ-наряд:`,
      orderUrl,
    ].filter((l) => l !== null);

    const messageText = messageLines.join('\n');

    // 6. Отправляем в MAX Bot API Александру Нигамедьянову
    let sendSuccess = false;
    let maxErrorDetails = '';

    try {
      const maxRes = await fetch(`https://botapi.max.ru/messages?user_id=${ALEX_MAX_USER_ID}`, {
        method: 'POST',
        headers: {
          Authorization: MAX_BOT_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: messageText }),
      });

      if (maxRes.ok) {
        sendSuccess = true;
      } else {
        maxErrorDetails = await maxRes.text();
        console.error(`MAX Bot API returned status ${maxRes.status}:`, maxErrorDetails);
      }
    } catch (e: any) {
      maxErrorDetails = e?.message || 'Network error';
      console.error('Failed to send MAX notification to Alexander:', e);
    }

    if (!sendSuccess) {
      return NextResponse.json(
        {
          error: `Не удалось доставить сообщение в MAX: ${maxErrorDetails}`,
        },
        { status: 502 },
      );
    }

    // 7. Делаем отметку в заказе и журнале аудита
    const nowIso = new Date().toISOString();
    const stampText = `[Отправлено на согласование Александру в MAX: ${new Date().toLocaleString('ru-RU')}]`;
    const updatedAdminNote = order.admin_note ? `${order.admin_note}\n${stampText}` : stampText;

    await (supabase.from('service_orders') as any)
      .update({
        admin_note: updatedAdminNote,
        updated_at: nowIso,
      })
      .eq('id', order.id);

    try {
      await (supabase.from('audit_log') as any).insert({
        table_name: 'service_orders',
        record_id: order.id,
        action: 'send_approval_max',
        new_values: {
          recipient_name: 'Нигамедьянов Александр',
          recipient_max_id: ALEX_MAX_USER_ID,
          works_count: works.length,
          sent_at: nowIso,
        },
      });
    } catch (logErr) {
      console.warn('Failed to insert audit log:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Заказ-наряд успешно отправлен на согласование руководителю в MAX',
      recipient: 'Нигамедьянов Александр',
      sent_at: nowIso,
      order_number: order.order_number,
    });
  } catch (error: any) {
    console.error('Error sending order approval to MAX:', error);
    return NextResponse.json(
      { error: error?.message || 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
}
