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
    const eventRaw = String(payload.event || payload.action || payload.type || '').toLowerCase();
    const unitStr = String(
      payload.unit || payload.unit_name || payload.unitName || payload.name || '',
    );
    const unitIdStr = payload.unit_id ? String(payload.unit_id) : undefined;
    const timeStr =
      payload.time || payload.timestamp || payload.curr_time || new Date().toISOString();

    let rawOdo = payload.odometer || payload.odo || payload.mileage;
    let odometer: number | undefined = undefined;
    if (rawOdo !== undefined && rawOdo !== null && !isNaN(Number(rawOdo))) {
      const num = Number(rawOdo);
      // Если одометр передан в метрах (> 1 000 000 для обычного пробега), переводим в км
      odometer = num > 2000000 ? Math.round(num / 1000) : Math.round(num);
    }

    if (!unitStr && !unitIdStr) {
      return NextResponse.json({ error: 'Параметр unit или unit_id обязателен' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const asset = await findAssetByWialonUnit(supabase, unitStr, unitIdStr);

    if (!asset) {
      return NextResponse.json(
        { error: `Автомобиль Wialon "${unitStr}" не найден в базе данных assets` },
        { status: 404 },
      );
    }

    // Если Wialon не прислал значение одометра, берем текущий одометр актива
    const odoValue = odometer && odometer > 0 ? odometer : asset.odometer_current || 120000;

    // Определяем событие: выезд (старт) или въезд (финиш)
    const isDeparture =
      eventRaw.includes('depart') ||
      eventRaw.includes('exit') ||
      eventRaw.includes('out') ||
      eventRaw.includes('leave') ||
      eventRaw.includes('выезд');

    const isArrival =
      eventRaw.includes('arrive') ||
      eventRaw.includes('enter') ||
      eventRaw.includes('in') ||
      eventRaw.includes('return') ||
      eventRaw.includes('въезд') ||
      eventRaw.includes('приезд');

    if (isDeparture) {
      const result = await handleVehicleDeparture(supabase, {
        vehicleId: asset.id,
        odometer: odoValue,
        timestamp: typeof timeStr === 'string' ? timeStr : new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        event: 'departure',
        asset: { id: asset.id, reg_number: asset.reg_number },
        result,
      });
    }

    if (isArrival) {
      const result = await handleVehicleArrival(supabase, {
        vehicleId: asset.id,
        odometer: odoValue,
        timestamp: typeof timeStr === 'string' ? timeStr : new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        event: 'arrival',
        asset: { id: asset.id, reg_number: asset.reg_number },
        result,
      });
    }

    return NextResponse.json(
      {
        error: `Неизвестный тип события Wialon: "${eventRaw}". Ожидается "departure" (выезд) или "arrival" (въезд).`,
      },
      { status: 400 },
    );
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
