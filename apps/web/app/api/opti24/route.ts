/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOpti24ContractBalance, getOpti24Cards } from '@/lib/opti24';

// Простой счетчик дневных вызовов в памяти инстанса
let dailyCallsCount = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

function trackCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    dailyCallsCount = 0;
    lastResetDate = today;
  }
  dailyCallsCount++;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Получаем список авто из БД с привязанными картами
    const supabase = createAdminClient();
    const { data: assets } = await supabase
      .from('assets')
      .select(
        'id, reg_number, short_name, opti24_card_number, assigned_driver_id, users:assigned_driver_id(name)',
      )
      .order('reg_number');

    // Карта привязки: cleanCardNumber -> asset
    const assetMap = new Map<string, any>();
    assets?.forEach((a) => {
      if (a.opti24_card_number) {
        const clean = a.opti24_card_number.replace(/\s+/g, '');
        assetMap.set(clean, a);
      }
    });

    if (forceRefresh) {
      trackCall();
    }

    // Запрашиваем баланс и карты (модуль opti24 кэширует ответы на 15 мин, чтобы беречь лимит)
    const [contractBalance, cardsList] = await Promise.all([
      getOpti24ContractBalance(),
      getOpti24Cards(),
    ]);

    // Обогащаем список карт данными наших автомобилей
    const enrichedCards = cardsList.map((card) => {
      const cleanNum = card.number.replace(/\s+/g, '');
      const linkedAsset = assetMap.get(cleanNum);
      return {
        ...card,
        linkedAsset: linkedAsset
          ? {
              id: linkedAsset.id,
              regNumber: linkedAsset.reg_number,
              name: linkedAsset.short_name,
              driver: linkedAsset.users?.name || null,
            }
          : null,
      };
    });

    // Машины ТК501, у которых карта не найдена в текущем договоре (например, боевая карта в демо-API)
    const unmappedAssets = (assets || [])
      .filter((a) => {
        if (!a.opti24_card_number) return false;
        const clean = a.opti24_card_number.replace(/\s+/g, '');
        return !cardsList.some((c) => c.number.replace(/\s+/g, '') === clean);
      })
      .map((a) => ({
        id: a.id,
        regNumber: a.reg_number,
        name: a.short_name,
        cardNumber: a.opti24_card_number,
        driver: (a as any).users?.name || null,
      }));

    return NextResponse.json({
      success: true,
      quota: {
        limitPerDay: 12,
        estimatedMonthReserve: 140, // 500 - (12 * 30) = 140
        callsToday: dailyCallsCount,
      },
      contract: contractBalance,
      cards: enrichedCards,
      unmappedAssets,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Opti24 Route Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Ошибка запроса к Opti24 API',
      },
      { status: 500 },
    );
  }
}
