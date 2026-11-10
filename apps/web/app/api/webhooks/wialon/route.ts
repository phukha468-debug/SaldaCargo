/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleVehicleDeparture, handleVehicleArrival } from '@saldacargo/domain-service';

/**
 * Нормализация госномера (очистка от спецсимволов и приведение латинских аналогов к кириллице)
 */
function normalizeRegNumber(raw: string): string {
  if (!raw) return '';
  const latToCyrMap: Record<string, string> = {
    A: 'А',
    B: 'В',
    E: 'Е',
    K: 'К',
    M: 'М',
    H: 'Н',
    O: 'О',
    P: 'Р',
    C: 'С',
    T: 'Т',
    Y: 'У',
    X: 'Х',
  };

  const upper = raw.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
  let normalized = '';
  for (const ch of upper) {
    normalized += latToCyrMap[ch] || ch;
  }
  return normalized;
}

/**
 * Явная карта соответствия ID объектов Wialon и госномеров
 */
const WIALON_ID_TO_PLATE: Record<string, string> = {
  '11873': 'А096МВ196',
  '11876': 'О188ТА196',
  '11875': 'У446ВН96',
  '11874': 'У883АР96',
};

/**
 * Явная карта соответствия имен объектов Wialon и госномеров Валдаев
 */
const WIALON_VALDAI_MAP: Record<string, string> = {
  НИГАМЕДЬЯНОВА096МВ196: 'А096МВ196',
  НИГАМЕДЬЯНОВО188ТА196: 'О188ТА196',
  НИГАМЕДЬЯНОВУ446ВН96: 'У446ВН96',
  НИГАМЕДЬЯНОВУ883АР96: 'У883АР96',
};

/**
 * Поиск автомобиля в базе assets по имени или номеру из Wialon
 */
async function findAssetByWialonUnit(supabase: any, unitStr: string, unitIdStr?: string) {
  // 0. Поиск по прямому маппингу ID Wialon (11873, 11876 и т.д.)
  const targetFromId = unitIdStr ? WIALON_ID_TO_PLATE[unitIdStr] : undefined;
  const clean = normalizeRegNumber(unitStr);
  const targetReg = targetFromId || WIALON_VALDAI_MAP[clean] || clean;

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, odometer_current, notes')
    .eq('status', 'active');

  if (error || !assets || assets.length === 0) {
    return null;
  }

  // 1. Поиск по целевому номеру (из ID Wialon или карты имен)
  for (const asset of assets) {
    const assetNorm = normalizeRegNumber(asset.reg_number || '');
    const shortNorm = normalizeRegNumber(asset.short_name || '');
    if (assetNorm === targetReg || shortNorm === targetReg) {
      return asset;
    }
  }

  // 2. Поиск по вхождению госномера в имя Wialon (например "Нигамедьянов А096МВ196")
  for (const asset of assets) {
    const assetNorm = normalizeRegNumber(asset.reg_number || '');
    const shortNorm = normalizeRegNumber(asset.short_name || '');
    if (assetNorm && (clean.includes(assetNorm) || assetNorm.includes(clean))) {
      return asset;
    }
    if (shortNorm && (clean.includes(shortNorm) || shortNorm.includes(clean))) {
      return asset;
    }
  }

  // 3. Поиск по заметкам (где может быть сохранен wialon_unit_id)
  if (unitIdStr) {
    for (const asset of assets) {
      if (asset.notes && asset.notes.includes(unitIdStr)) {
        return asset;
      }
    }
  }

  return null;
}

/**
 * Унифицированный обработчик вебхука Wialon
 * Поддерживает как GET, так и POST запросы
 */
async function processWialonEvent(req: Request) {
  try {
    const url = new URL(req.url);
    let payload: Record<string, any> = {};

    if (req.method === 'POST') {
      try {
        const rawBody = await req.text();
        if (rawBody) {
          try {
            const parsed = JSON.parse(rawBody);
            if (parsed && typeof parsed === 'object') {
              payload = { ...parsed };
            }
          } catch {
            if (rawBody.includes('=')) {
              const sp = new URLSearchParams(rawBody);
              sp.forEach((val, key) => {
                payload[key] = val;
              });
            }
            payload.raw_body = rawBody;
            if (!payload.text) {
              payload.text = rawBody;
            }
          }
        }
      } catch (e) {
        console.warn('[Wialon Webhook] Ошибка чтения POST body:', e);
      }
    }

    // Параметры из query string перекрывают или дополняют body (если они не нераскрытые макросы вроде %UNIT%)
    url.searchParams.forEach((val, key) => {
      if (!val.startsWith('%') || !val.endsWith('%')) {
        payload[key] = val;
      } else if (!payload[key]) {
        payload[key] = val;
      }
    });

    // Извлечение ключевых параметров Wialon
    const eventCandidate = String(
      payload.event ||
        payload.action ||
        payload.type ||
        payload.zone_status ||
        payload.status ||
        payload.notification ||
        payload.text ||
        payload.raw_body ||
        '',
    )
      .trim()
      .toLowerCase();

    let unitStr = String(
      payload.unit || payload.unit_name || payload.unitName || payload.name || '',
    ).trim();

    // Если передан нераскрытый тег Wialon "%UNIT%", сбрасываем его
    if (unitStr.startsWith('%') && unitStr.endsWith('%')) {
      unitStr = '';
    }

    // Если имя объекта не передано отдельным полем, но есть текст уведомления
    if (!unitStr && (payload.text || payload.raw_body)) {
      unitStr = String(payload.text || payload.raw_body);
    }

    const unitIdStr = payload.unit_id ? String(payload.unit_id) : undefined;
    const timeStr =
      payload.time ||
      payload.timestamp ||
      payload.pos_time ||
      payload.curr_time ||
      new Date().toISOString();

    let rawOdo =
      payload.odometer ?? payload.odo ?? payload.mileage ?? payload.mileage_km ?? payload.km;
    if (typeof rawOdo === 'string' && rawOdo.startsWith('%') && rawOdo.endsWith('%')) {
      rawOdo = undefined;
    }
    let odometer: number | undefined = undefined;
    if (rawOdo !== undefined && rawOdo !== null) {
      if (typeof rawOdo === 'string') {
        const match = rawOdo
          .replace(/\s+/g, '')
          .replace(',', '.')
          .match(/(\d+(?:\.\d+)?)/);
        if (match && match[1]) rawOdo = match[1];
      }
      const num = Number(rawOdo);
      if (!isNaN(num) && num > 0) {
        // Если одометр передан в метрах (> 2 000 000 для пробега), переводим в км
        odometer = num > 2000000 ? Math.round(num / 1000) : Math.round(num);
      }
    }

    // Проверка секретного ключа (если задан в переменных окружения)
    const expectedSecret = process.env.WIALON_WEBHOOK_SECRET;
    const providedSecret = payload.secret || payload.token || req.headers.get('x-wialon-secret');
    if (expectedSecret && providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    if (!unitStr && !unitIdStr) {
      return NextResponse.json({ error: 'Параметр unit или unit_id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const asset = await findAssetByWialonUnit(supabase, unitStr, unitIdStr);

    if (!asset) {
      console.warn(
        `[Wialon Webhook] Автомобиль не найден для unit="${unitStr}", unit_id="${unitIdStr}"`,
      );
      return NextResponse.json({ error: 'Объект не найден' }, { status: 404 });
    }

    // Приоритет одометра:
    // Если Wialon передает реальный одометр трекера (например 139xxx км), используем его напрямую.
    // Это гарантирует, что разница (odoEnd - odoStart) считается в единой шкале трекера Wialon.
    const currentAssetOdo = Number(asset.odometer_current || 0);
    const odoValue = odometer && odometer > 0 ? Math.round(odometer) : currentAssetOdo || 120000;

    // Проверяем текст уведомления (например "%UNIT% вышел из %ZONE%." или "Выход из геозоны")
    const fullTextCandidate =
      `${payload.text || ''} ${payload.notification || ''} ${payload.name || ''}`.toLowerCase();
    const isExplicitTextExit =
      fullTextCandidate.includes('вышел') ||
      fullTextCandidate.includes('выход') ||
      fullTextCandidate.includes('покинул') ||
      fullTextCandidate.includes('выезд');
    const isExplicitTextEnter =
      fullTextCandidate.includes('вошел') ||
      fullTextCandidate.includes('вход') ||
      fullTextCandidate.includes('въезд') ||
      fullTextCandidate.includes('прибыл');

    // Определяем событие: выезд (старт) или въезд (финиш)
    const isDeparture =
      isExplicitTextExit ||
      (!isExplicitTextEnter &&
        (eventCandidate === '2' ||
          eventCandidate.includes('выход') ||
          eventCandidate.includes('выезд') ||
          eventCandidate.includes('покинул') ||
          eventCandidate.includes('уехал') ||
          eventCandidate.includes('depart') ||
          eventCandidate.includes('departure') ||
          eventCandidate.includes('exit') ||
          eventCandidate.includes('exited') ||
          eventCandidate.includes('leave') ||
          eventCandidate.includes('left') ||
          eventCandidate.includes('outside') ||
          eventCandidate === 'out'));

    const isArrival =
      isExplicitTextEnter ||
      (!isExplicitTextExit &&
        (eventCandidate === '1' ||
          eventCandidate.includes('вход') ||
          eventCandidate.includes('въезд') ||
          eventCandidate.includes('приезд') ||
          eventCandidate.includes('заезд') ||
          eventCandidate.includes('вошел') ||
          eventCandidate.includes('прибыл') ||
          eventCandidate.includes('arrive') ||
          eventCandidate.includes('arrival') ||
          eventCandidate.includes('enter') ||
          eventCandidate.includes('entered') ||
          eventCandidate.includes('inside') ||
          eventCandidate === 'in'));

    console.log(
      `[Wialon Webhook] Event: "${eventCandidate}" -> ${isDeparture ? 'DEPARTURE' : isArrival ? 'ARRIVAL' : 'UNKNOWN'} | Unit: ${unitStr} (Asset: ${asset.reg_number}, Odo: ${odoValue} km)`,
    );

    if (isDeparture) {
      await handleVehicleDeparture(supabase, {
        vehicleId: asset.id,
        odometer: odoValue,
        timestamp: typeof timeStr === 'string' ? timeStr : new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    if (isArrival) {
      await handleVehicleArrival(supabase, {
        vehicleId: asset.id,
        odometer: odoValue,
        timestamp: typeof timeStr === 'string' ? timeStr : new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Некорректный тип события' }, { status: 400 });
  } catch (err: any) {
    console.error('Ошибка обработки вебхука Wialon:', err);
    return NextResponse.json({ error: err?.message || 'Внутренняя ошибка' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return processWialonEvent(req);
}

export async function POST(req: Request) {
  return processWialonEvent(req);
}
