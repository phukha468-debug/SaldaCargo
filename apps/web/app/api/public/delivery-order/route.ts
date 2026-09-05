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

    const {
      storeName = 'Магазин-партнёр',
      pickupAddress = '',
      deliveryAddress = '',
      distanceKm = 0,
      carPrice = 0,
      hasLoaders = false,
      loadersCount = 1,
      loadersCrewText = '',
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

    const messageText = [
      `🚚 НОВЫЙ ЗАКАЗ ДОСТАВКИ: ${storeName}`,
      `━━━━━━━━━━━━━━━━━━`,
      `📦 Заказ: ${orderNumber}`,
      `📍 Откуда: ${pickupAddress || storeName}`,
      `🏁 Куда: ${deliveryAddress}`,
      `🛣 Дистанция: ${distanceKm} км`,
      ``,
      ...(isLoaders
        ? [
            `📦 ГРУЗ И ПРР:`,
            `• Номенклатура: ${cargoName || 'Товар из магазина'}`,
            `• Категория: ${categoryLabel}`,
            cargoValue > 0 ? `• Стоимость товара: ${cargoValue.toLocaleString('ru-RU')} ₽` : null,
            cargoValue > 30000 ? `  *(Ответственность: +100 ₽/эт за ценный груз)*` : null,
            `• Состав бригады: ${crewLine}`,
            `• Этаж: ${floor} эт. (${elevatorLabel})`,
            hasLongCarry ? `• Пронос от машины: более 25 м (+1 этаж)` : null,
            ``,
          ]
        : [`📦 УСЛУГА:`, `• Доставка автомобилем (без грузчиков / без ПРР)`, ``]),
      `💰 РАСЧЁТ СТОИМОСТИ:`,
      `• Автомобиль: ${Number(carPrice).toLocaleString('ru-RU')} ₽`,
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
          has_loaders: isLoaders,
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
            (u: any) => u.max_user_id && (u.roles?.includes('admin') || u.roles?.includes('owner')),
          )
          .map((u: any) => u.max_user_id);

        const uniqueRecipients = Array.from(new Set([...recipients, '56628256', '133117579']));

        await Promise.all(
          uniqueRecipients.map((userId) =>
            fetch(`https://botapi.max.ru/messages?user_id=${userId}`, {
              method: 'POST',
              headers: {
                Authorization: maxToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ text: messageText }),
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

/**
 * GET /api/public/delivery-order
 * Получение списка заявок из audit_log с фильтрацией по магазину и периоду
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const store = searchParams.get('store');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    const supabaseAdmin = createAdminClient();

    let query = (supabaseAdmin.from('audit_log') as any)
      .select('id, new_values, created_at')
      .eq('table_name', 'delivery_requests')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    let orders = (data || []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      ...row.new_values,
    }));

    if (store && store !== 'all') {
      const sLower = store.toLowerCase();
      orders = orders.filter(
        (o: any) =>
          (o.store_name && o.store_name.toLowerCase().includes(sLower)) ||
          (o.storeName && o.storeName.toLowerCase().includes(sLower)),
      );
    }

    // Подсчёт сводки по магазинам
    const storeStats: Record<string, { count: number; totalSum: number }> = {};
    for (const ord of orders) {
      const sName = ord.store_name || ord.storeName || 'Прочие магазины';
      if (!storeStats[sName]) {
        storeStats[sName] = { count: 0, totalSum: 0 };
      }
      storeStats[sName].count += 1;
      storeStats[sName].totalSum += Number(ord.total_price || ord.totalPrice || 0);
    }

    return NextResponse.json(
      {
        success: true,
        orders,
        storeStats,
        totalCount: orders.length,
        grandTotal: orders.reduce(
          (sum: number, o: any) => sum + Number(o.total_price || o.totalPrice || 0),
          0,
        ),
      },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (error: any) {
    console.error('Error fetching delivery orders:', error);
    return NextResponse.json(
      { error: error?.message || 'Ошибка получения заявок' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
