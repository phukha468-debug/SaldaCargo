/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

const MAX_BOT_API = 'https://botapi.max.ru';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      storeName = 'Магазин-партнёр',
      pickupAddress = '',
      deliveryAddress = '',
      distanceKm = 0,
      carPrice = 0,
      hasLoaders = false,
      loadersCount = 1,
      cargoCategory = 'standard',
      cargoName = '',
      cargoValue = 0,
      floor = 1,
      elevatorType = 'none',
      hasLongCarry = false,
      loadersPrice = 0,
      totalPrice = 0,
      managerName = '',
      managerPhone = '',
      clientName = '',
      clientPhone = '',
      preferredTime = '',
      notes = '',
    } = body;

    if (!deliveryAddress || !clientPhone) {
      return NextResponse.json(
        { error: 'Укажите адрес доставки и контактный телефон' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const orderNumber = `№${Date.now().toString().slice(-4)}`;

    let categoryLabel = 'Стандартный (до 25 кг)';
    if (cargoCategory === 'oversized') categoryLabel = 'Негабаритный (диван, матрас 160+, шкаф)';
    if (cargoCategory === 'heavy') categoryLabel = 'Тяжёлый (> 45 кг: двери, сейф, ванна)';

    let elevatorLabel = 'Без лифта (пешком)';
    if (elevatorType === 'cargo') elevatorLabel = 'Грузовой лифт';
    if (elevatorType === 'passenger') elevatorLabel = 'Пассажирский лифт';

    const messageText = [
      `🚚 НОВЫЙ ЗАКАЗ ДОСТАВКИ: ${storeName}`,
      `━━━━━━━━━━━━━━━━━━`,
      `📦 Заказ: ${orderNumber}`,
      `📍 Откуда: ${pickupAddress || storeName}`,
      `🏁 Куда: ${deliveryAddress}`,
      `🛣 Дистанция: ${distanceKm} км`,
      ``,
      `📦 ГРУЗ И ПРР:`,
      `• Номенклатура: ${cargoName || 'Товар из магазина'}`,
      `• Категория: ${categoryLabel}`,
      cargoValue > 0 ? `• Стоимость товара: ${cargoValue.toLocaleString('ru-RU')} ₽` : null,
      cargoValue > 30000 ? `  *(Ответственность: +100 ₽/эт за ценный груз)*` : null,
      `• Грузчики: ${hasLoaders ? `${loadersCount} чел.` : 'Без грузчиков'}`,
      `• Этаж: ${floor} эт. (${elevatorLabel})`,
      hasLongCarry ? `• Пронос от машины: более 25 м (+1 этаж)` : null,
      ``,
      `💰 РАСЧЁТ СТОИМОСТИ:`,
      `• Автомобиль: ${Number(carPrice).toLocaleString('ru-RU')} ₽`,
      hasLoaders
        ? `• Погрузка и занос (ПРР): ${Number(loadersPrice).toLocaleString('ru-RU')} ₽`
        : null,
      `━━━━━━━━━━━━━━━━━━`,
      `ИТОГО К ОПЛАТЕ: ${Number(totalPrice).toLocaleString('ru-RU')} ₽`,
      ``,
      `👤 КОНТАКТЫ:`,
      `• Клиент: ${clientName || 'Получатель'} (${clientPhone})`,
      managerName || managerPhone ? `• Менеджер магазина: ${managerName} (${managerPhone})` : null,
      preferredTime ? `• Желаемое время: ${preferredTime}` : null,
      notes ? `• Примечание: ${notes}` : null,
    ]
      .filter((line) => line !== null)
      .join('\n');

    const supabaseAdmin = createAdminClient();

    try {
      await (supabaseAdmin.from('audit_log') as any).insert({
        table_name: 'delivery_requests',
        record_id: '00000000-0000-0000-0000-000000000000',
        action: 'insert',
        new_values: {
          order_number: orderNumber,
          store_name: storeName,
          pickup_address: pickupAddress,
          delivery_address: deliveryAddress,
          distance_km: distanceKm,
          car_price: carPrice,
          has_loaders: hasLoaders,
          loaders_count: loadersCount,
          cargo_category: cargoCategory,
          cargo_name: cargoName,
          cargo_value: cargoValue,
          floor,
          elevator_type: elevatorType,
          has_long_carry: hasLongCarry,
          loaders_price: loadersPrice,
          total_price: totalPrice,
          client_name: clientName,
          client_phone: clientPhone,
          manager_name: managerName,
          manager_phone: managerPhone,
          preferred_time: preferredTime,
          notes,
          created_at: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      console.error('Failed to log delivery order in database:', dbErr);
    }

    const maxToken = process.env.MAX_BOT_TOKEN;
    if (maxToken) {
      try {
        const { data: adminUsers } = await (supabaseAdmin
          .from('users')
          .select('id, name, max_user_id, roles') as any);

        const recipients = (adminUsers ?? [])
          .filter(
            (u: any) => u.max_user_id && (u.roles?.includes('admin') || u.roles?.includes('owner')),
          )
          .map((u: any) => u.max_user_id);

        const uniqueRecipients = Array.from(new Set([...recipients, '56628256']));

        await Promise.all(
          uniqueRecipients.map((userId) =>
            fetch(`${MAX_BOT_API}/sendMessage?access_token=${maxToken}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, text: messageText }),
            }).catch((e) => console.error(`Failed to send MAX notification to ${userId}:`, e)),
          ),
        );
      } catch (maxErr) {
        console.error('MAX Bot error:', maxErr);
      }
    }

    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChatId = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: messageText,
          }),
        });
      } catch (tgErr) {
        console.error('Telegram notification error:', tgErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        orderNumber,
        message: 'Заявка успешно оформлена! Машина назначена.',
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error('Error handling public delivery order:', error);
    return NextResponse.json(
      { error: error?.message || 'Ошибка сервера при оформлении заявки' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
