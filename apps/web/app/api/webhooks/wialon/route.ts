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
  const clean = normalizeRegNumber(unitStr);
  const targetReg = WIALON_VALDAI_MAP[clean] || clean;

  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, reg_number, short_name, odometer_current, notes')
    .eq('status', 'active');

  if (error || !assets || assets.length === 0) {
    return null;
  }

  // 1. Поиск по явной карте или полному совпадению
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

  // Поиск по заметкам (где может быть сохранен wialon_unit_id)
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
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          payload = await req.json();
        } catch {
          payload = {};
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        formData.forEach((val, key) => {
          payload[key] = val.toString();
        });
      }
    }

    // Параметры из query string перекрывают или дополняют body
    url.searchParams.forEach((val, key) => {
      payload[key] = val;
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
        '',
    )
      .trim()
      .toLowerCase();

    let unitStr = String(
      payload.unit || payload.unit_name || payload.unitName || payload.name || '',
    ).trim();

    // Если имя объекта не передано отдельным полем, но есть текст уведомления
    if (!unitStr && payload.text) {
      unitStr = String(payload.text);
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

    // Если Wialon не прислал значение одометра, берем текущий одометр актива
    const odoValue = odometer && odometer > 0 ? odometer : asset.odometer_current || 120000;

    // Определяем событие: выезд (старт) или въезд (финиш)
    const isDeparture =
      eventCandidate === '2' ||
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
      eventCandidate === 'out';

    const isArrival =
      eventCandidate === '1' ||
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
      eventCandidate === 'in';

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
