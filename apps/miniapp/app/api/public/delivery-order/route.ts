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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'verify_pin') {
      const pin = String(body.pin || '').trim();
      const STORE_PINS: Record<string, { storeKey: string; storeName: string; category: string }> =
        {
          '4141': {
            storeKey: 'tiles',
            storeName: 'Плитка (ул. Рабочей Молодёжи, 41)',
            category: 'build',
          },
          '2727': {
            storeKey: 'levsha',
            storeName: 'Левша (ул. Спортивная, 2, корп. 7)',
            category: 'build',
          },
          '2503': { storeKey: 'doors', storeName: 'Двери (ул. 25 Октября, 3)', category: 'build' },
          '8701': {
            storeKey: 'mebel_angela',
            storeName: 'Мебель Анжела (ул. Энгельса, 87, корп. 1)',
            category: 'furniture',
          },
          '0501': {
            storeKey: 'interier',
            storeName: 'Интерьер (ул. Парковая, 5, корп. 1)',
            category: 'furniture',
          },
          '0401': {
            storeKey: 'obstanovochka',
            storeName: 'Обстановочка (ул. Воронова, 4, корп. 1)',
            category: 'furniture',
          },
          '6600': { storeKey: 'admin', storeName: 'Диспетчер SaldaCargo', category: 'all' },
          '1111': {
            storeKey: 'tiles',
            storeName: 'Плитка (ул. Рабочей Молодёжи, 41)',
            category: 'build',
          },
          '2222': {
            storeKey: 'levsha',
            storeName: 'Левша (ул. Спортивная, 2, корп. 7)',
            category: 'build',
          },
          '3333': { storeKey: 'doors', storeName: 'Двери (ул. 25 Октября, 3)', category: 'build' },
          '4444': {
            storeKey: 'mebel_angela',
            storeName: 'Мебель Анжела (ул. Энгельса, 87, корп. 1)',
            category: 'furniture',
          },
          '5555': {
            storeKey: 'interier',
            storeName: 'Интерьер (ул. Парковая, 5, корп. 1)',
            category: 'furniture',
          },
          '6666': {
            storeKey: 'obstanovochka',
            storeName: 'Обстановочка (ул. Воронова, 4, корп. 1)',
            category: 'furniture',
          },
          '7777': { storeKey: 'admin', storeName: 'Диспетчер SaldaCargo', category: 'all' },
        };

      const matched = STORE_PINS[pin];
      if (!matched) {
        return NextResponse.json(
          { success: false, error: 'Неверный PIN-код магазина' },
          { status: 401, headers: CORS_HEADERS },
        );
      }

      const yandexApiKey =
        process.env.YANDEX_MAPS_API_KEY || 'bb711687-f130-43ef-bde7-9308dfa82254';

      return NextResponse.json(
        {
          success: true,
          storeKey: matched.storeKey,
          storeName: matched.storeName,
          category: matched.category,
          yandexApiKey,
        },
        { status: 200, headers: CORS_HEADERS },
      );
    }

    const {
      storeName = 'Магазин-партнёр',
      storeCategory = '',
      pickupAddress = '',
      hasPickupCarry = true,
      deliveryAddress = '',
      hasExtraPoint = false,
      extraPointAddress = '',
      extraPointPrice = 0,
      extraDisposalCarry = false,
      distanceKm = 0,
      distanceKmLeg1 = 0,
      distanceKmLeg2 = 0,
      carPrice = 0,
      hasLoaders = false,
      loadersCount = 1,
      loadersCrewText = '',
      items = [],
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

    const isLoaders = Boolean(hasLoaders && hasLoaders !== 'false' && hasLoaders !== '0');

    const crewLine = loadersCrewText
      ? loadersCrewText
      : loadersCount === 1
        ? '1 чел. (водитель один)'
        : loadersCount === 2
          ? '2 чел. (водитель + напарник)'
          : `${loadersCount} чел. (усиленная бригада)`;

    const itemsLines =
      items && Array.isArray(items) && items.length > 0
        ? items.map(
            (it: any) =>
              `  • ${it.name}: ${it.count} ${it.unit || 'шт'} (${(it.pricePerFloor || 0) * (it.count || 1)} ₽/эт)`,
          )
        : cargoName
          ? [`  • Номенклатура: ${cargoName}`, `  • Категория: ${categoryLabel}`]
          : [];

    const routeHeaderLines =
      hasExtraPoint && extraPointAddress
        ? [
            `📍 МАРШРУТ (через 2 точки):`,
            `  1. Погрузка: ${pickupAddress || storeName}`,
            `  2. Точка А (доставка): ${deliveryAddress}`,
            `  3. Точка Б (заезд/вывоз): ${extraPointAddress}`,
            extraDisposalCarry ? `     └ Опция: вывоз/спуск старой мебели (+500 ₽)` : null,
            `🛣 Дистанция: ${distanceKm} км${distanceKmLeg1 && distanceKmLeg2 ? ` (Плечо 1: ${distanceKmLeg1} км + Плечо 2: ${distanceKmLeg2} км)` : ''}`,
          ]
        : [
            `📍 Откуда: ${pickupAddress || storeName}`,
            `🏁 Куда: ${deliveryAddress}`,
            `🛣 Дистанция: ${distanceKm} км`,
          ];

    const messageText = [
      `🚚 НОВЫЙ ЗАКАЗ ДОСТАВКИ: ${storeName}`,
      `━━━━━━━━━━━━━━━━━━`,
      `📦 Заказ: ${orderNumber}`,
      ...routeHeaderLines,
      ``,
      ...(isLoaders
        ? [
            `📦 ГРУЗ И ПРР:`,
            ...itemsLines,
            cargoValue > 0 ? `• Стоимость товара: ${cargoValue.toLocaleString('ru-RU')} ₽` : null,
            cargoValue > 30000 ? `  *(Ответственность: +100 ₽/эт за ценный груз)*` : null,
            `• Состав бригады: ${crewLine}`,
            `• Этаж доставки: ${floor} эт. (${elevatorLabel})`,
            hasLongCarry ? `• Пронос от машины: более 25 м (+1 этаж к заносу)` : null,
            hasPickupCarry === false ? `• Погрузка в магазине: силами магазина (без выноса)` : null,
            ``,
          ]
        : [`📦 УСЛУГА:`, `• Доставка автомобилем (без грузчиков / без ПРР)`, ``]),
      `💰 РАСЧЁТ СТОИМОСТИ:`,
      `• Автомобиль: ${Number(carPrice).toLocaleString('ru-RU')} ₽${hasExtraPoint ? ` (вкл. заезд во 2-ю точку +${extraPointPrice || 500} ₽)` : ''}`,
      extraDisposalCarry ? `• Спуск/вывоз старой мебели: 500 ₽` : null,
      isLoaders
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

    // 1. Сохраняем в audit_log (как заявку на доставку)
    try {
      await (supabaseAdmin.from('audit_log') as any).insert({
        table_name: 'delivery_requests',
        record_id: '00000000-0000-0000-0000-000000000000',
        action: 'insert',
        new_values: {
          order_number: orderNumber,
          store_name: storeName,
          store_category: storeCategory,
          pickup_address: pickupAddress,
          has_pickup_carry: hasPickupCarry,
          delivery_address: deliveryAddress,
          has_extra_point: Boolean(hasExtraPoint),
          extra_point_address: extraPointAddress || '',
          extra_point_price: extraPointPrice || 0,
          extra_disposal_carry: Boolean(extraDisposalCarry),
          distance_km: distanceKm,
          distance_km_leg1: distanceKmLeg1 || 0,
          distance_km_leg2: distanceKmLeg2 || 0,
          car_price: carPrice,
          has_loaders: isLoaders,
          loaders_count: loadersCount,
          items: items || [],
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

    // 2. Отправляем в MAX Бот администраторам и диспетчеру
    const maxToken =
      process.env.MAX_BOT_TOKEN ||
      'f9LHodD0cOKEmAc4Iy6Hq4JXmmVPVRpQ7vULw35IPAeFKQZMIpb1fSAwl5wl_mY1GcLcovMyJXcGngyIqypb';
    if (maxToken) {
      try {
        const { data: adminUsers } = await (supabaseAdmin
          .from('users')
          .select('id, name, max_user_id, roles') as any);

        const recipients = (adminUsers ?? [])
          .filter(
            (u: any) =>
              u.max_user_id &&
              (u.roles?.includes('admin') ||
                u.roles?.includes('owner') ||
                u.roles?.includes('dispatcher')),
          )
          .map((u: any) => u.max_user_id);

        const uniqueRecipients = Array.from(new Set([...recipients, '56628256', '76489387']));

        await Promise.all(
          uniqueRecipients.map(async (userId) => {
            try {
              const res = await fetch(`https://botapi.max.ru/messages?user_id=${userId}`, {
                method: 'POST',
                headers: {
                  Authorization: maxToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: messageText }),
              });
              if (!res.ok) {
                const errText = await res.text();
                console.error(
                  `Failed to send MAX notification to ${userId}: HTTP ${res.status} - ${errText}`,
                );
              }
            } catch (e) {
              console.error(`Failed to send MAX notification to ${userId}:`, e);
            }
          }),
        );
      } catch (maxErr) {
        console.error('MAX Bot error:', maxErr);
      }
    }

    // 3. Отправляем в Telegram Бот (если настроен)
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
