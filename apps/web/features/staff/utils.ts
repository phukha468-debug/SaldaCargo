import { ADVANCE_CAT, PAYROLL_CATS } from './constants';
import type { PassportData, StaffTx } from './types';

export function parseUserNotesAndPassport(
  user?: { notes?: string | null; passport_data?: PassportData | null } | null,
) {
  let noteText: string | null = null;
  let passport: PassportData | null = user?.passport_data ?? null;

  const raw = user?.notes;
  if (raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof parsed === 'object' && parsed !== null) {
          if (!passport) passport = parsed as PassportData;
          noteText = typeof parsed.user_notes === 'string' ? parsed.user_notes : null;
        }
      } catch {
        noteText = trimmed;
      }
    } else {
      noteText = trimmed;
    }
  }

  return { noteText, passport };
}

export function classifyStaffTx(tx: StaffTx) {
  const isAdvanceGiven = tx.category_id === ADVANCE_CAT && tx.direction === 'expense';
  const isAdvanceOffset = tx.category_id === ADVANCE_CAT && tx.direction === 'income';
  const isPayout =
    Boolean(tx.from_wallet_id) ||
    Boolean(tx.description && tx.description.startsWith('Выплата зарплаты'));
  const isPayrollAccrual = PAYROLL_CATS.includes(tx.category_id) && !isPayout;

  if (isPayrollAccrual) {
    let source = 'Зарплата';
    const lower = (tx.description || '').toLowerCase();
    if (lower.includes('рейс')) {
      source = 'Рейс';
    } else if (lower.includes('наряд') || lower.includes('нз-') || lower.includes('н3-')) {
      source = 'Гараж / СТО';
    }
    return {
      type: 'accrual' as const,
      isIncome: true,
      badgeText: 'Заработано',
      badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      source,
      title: tx.description || 'Начисление зарплаты',
    };
  }

  if (isPayout) {
    const walletName =
      tx.from_wallet?.name ||
      (tx.description?.includes('Касса')
        ? '💵 Касса наличные'
        : tx.description?.includes('Р/С') || tx.description?.includes('Банк')
          ? '🏦 Р/С (Банк)'
          : '💵 Выплата деньгами');
    return {
      type: 'payout' as const,
      isIncome: false,
      badgeText: 'Выплата ЗП',
      badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
      source: walletName,
      title: tx.description || 'Выплата зарплаты',
    };
  }

  if (isAdvanceGiven) {
    const isTax =
      tx.description?.includes('Налог') ||
      tx.description?.includes('ТК РФ') ||
      tx.description?.includes('Вычет по ТК РФ');
    const walletName = isTax
      ? '💼 Налог по ТК РФ'
      : tx.from_wallet?.name ||
        (tx.description?.includes('Касса') ? '💵 Касса наличные' : '💰 Аванс');
    return {
      type: 'advance' as const,
      isIncome: false,
      badgeText: isTax ? 'Налог ТК РФ' : 'Выдан аванс',
      badgeCls: isTax
        ? 'bg-amber-50 text-amber-900 border-amber-300'
        : 'bg-purple-50 text-purple-700 border-purple-200',
      source: walletName,
      title: tx.description || (isTax ? 'Налог ТК РФ' : 'Выдан аванс'),
    };
  }

  if (isAdvanceOffset) {
    return {
      type: 'offset' as const,
      isIncome: true,
      badgeText: 'Зачёт аванса',
      badgeCls: 'bg-slate-100 text-slate-600 border-slate-200',
      source: 'Взаимозачёт',
      title: tx.description || 'Зачёт ранее выданного аванса',
    };
  }

  return {
    type: 'other' as const,
    isIncome: tx.direction === 'income',
    badgeText: tx.direction === 'income' ? 'Поступление' : 'Списание',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-200',
    source: 'Операция',
    title: tx.description || 'Операция',
  };
}

export function parseAccrualMeta(tx: StaffTx) {
  const desc = tx.description || '';
  const so = tx.service_order;
  const trip = tx.trip;

  const orderMatch =
    desc.match(/(?:наряд|наряда|заказ-наряд|заказ-наряда)\s*[#№]?\s*([A-Za-zА-Яа-я0-9_-]+)/i) ||
    desc.match(/\b(Н[3З]-[0-9]+)\b/i);

  const tripMatch = desc.match(/(?:рейс|рейса)\s*[#№]?\s*([0-9]+)/i);

  let workName = '';
  const colonIndex = desc.indexOf(':');
  if (colonIndex !== -1) {
    const afterColon = desc.slice(colonIndex + 1).trim();
    const parenIndex = afterColon.indexOf('(');
    workName = parenIndex !== -1 ? afterColon.slice(0, parenIndex).trim() : afterColon;
  }

  if (tx.service_order_id || so || orderMatch) {
    const orderNum = so?.order_number
      ? String(so.order_number)
      : orderMatch
        ? orderMatch[1]
        : tx.service_order_id
          ? tx.service_order_id.slice(0, 8)
          : '';

    const orderIdToOpen = so?.id || tx.service_order_id || orderNum;
    const vehicleDesc = so?.vehicle_label || '';
    const eventDate =
      so?.order_date || so?.created_at || tx.transaction_date || tx.created_at || null;

    return {
      isOrder: true,
      isTrip: false,
      orderNumber: orderNum,
      service_order_id: orderIdToOpen,
      vehicleDesc,
      eventDate,
      workName: workName || 'Выполненные работы',
      groupKey: `order_${orderIdToOpen || orderNum}`,
    };
  }

  if (tx.trip_id || trip || tripMatch) {
    const tripNum = trip?.trip_number
      ? String(trip.trip_number)
      : tripMatch
        ? tripMatch[1]
        : tx.trip_id
          ? tx.trip_id.slice(0, 8)
          : '';
    const vehicleDesc = trip?.vehicle_label || '';
    const eventDate =
      trip?.trip_date ||
      trip?.started_at ||
      trip?.created_at ||
      tx.transaction_date ||
      tx.created_at ||
      null;

    return {
      isOrder: false,
      isTrip: true,
      tripNumber: tripNum,
      trip_id: trip?.id || tx.trip_id || null,
      vehicleDesc,
      eventDate,
      workName: desc,
      groupKey: `trip_${tx.trip_id || tripNum}`,
    };
  }

  return {
    isOrder: false,
    isTrip: false,
    vehicleDesc: '',
    eventDate: tx.transaction_date || tx.created_at || null,
    workName: desc || 'Начисление',
    groupKey: `tx_${tx.id}`,
  };
}
