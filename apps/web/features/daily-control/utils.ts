import type { CategoryItem, LinkableOrderItem, PeriodMode } from './types';

export function rub(val: number | string | null | undefined): string {
  const num = typeof val === 'number' ? val : parseFloat(String(val ?? '0')) || 0;
  return num.toLocaleString('ru-RU') + ' ₽';
}

export function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.toLocaleDateString('ru-RU', { weekday: 'short' });
  const dayMonth = d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${dow.toUpperCase()}, ${dayMonth}`;
}

export function getWeekDates(dStr: string) {
  const d = new Date(dStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diffToMon);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return {
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: sun.toISOString().slice(0, 10),
  };
}

export function formatPeriodHeader(dateStr: string, periodMode: PeriodMode): string {
  if (periodMode === 'day') {
    return formatDayHeader(dateStr);
  }
  if (periodMode === 'week') {
    const { weekStart, weekEnd } = getWeekDates(dateStr);
    const ws = new Date(weekStart + 'T12:00:00');
    const we = new Date(weekEnd + 'T12:00:00');
    return `${ws.getDate()} ${ws.toLocaleDateString('ru-RU', { month: 'short' })} — ${we.getDate()} ${we.toLocaleDateString('ru-RU', { month: 'short' })} ${we.getFullYear()} г.`;
  }
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).toUpperCase();
}

export function getOpLocalDate(
  dateOrOp:
    | string
    | {
        trxnPostDate?: string;
        authorizationDate?: string;
        operationDate?: string;
        operationTime?: string;
      }
    | null
    | undefined,
  tzHours = 5,
): string {
  if (!dateOrOp) return '';
  const raw =
    typeof dateOrOp === 'string'
      ? dateOrOp
      : dateOrOp.authorizationDate ||
        dateOrOp.operationDate ||
        dateOrOp.trxnPostDate ||
        dateOrOp.operationTime;
  if (!raw) return '';
  const d = new Date(new Date(raw).getTime() + tzHours * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/** Фильтрация статей: убирает доходы из расходов и схлопывает подстатьи ЗП в одну «Зарплата (ФОТ)» */
export function getFilteredCategories(
  categories: CategoryItem[] = [],
  direction: 'income' | 'expense' | 'transfer' = 'expense',
  currentCatId?: string | null,
): Array<{ id: string; name: string }> {
  if (direction === 'income') {
    return categories
      .filter((c) => c.direction === 'income')
      .map((c) => ({ id: c.id, name: c.name }));
  }

  const list: Array<{ id: string; name: string }> = [];
  const payrollCategories = categories.filter(
    (c) =>
      c.code === 'PAYROLL_DRIVER' ||
      c.code === 'PAYROLL_LOADER' ||
      c.code === 'PAYROLL_MECHANIC' ||
      c.code === 'PAYROLL' ||
      c.name.toLowerCase().startsWith('зп '),
  );

  const matchedPayroll = payrollCategories.find((c) => c.id === currentCatId);
  const payrollId =
    matchedPayroll?.id || payrollCategories[0]?.id || 'd79213ee-3bc6-4433-b58a-ca7ea1040d00';

  let addedPayroll = false;
  for (const c of categories) {
    if (c.direction === 'income') continue;

    const isPayroll =
      c.code === 'PAYROLL_DRIVER' ||
      c.code === 'PAYROLL_LOADER' ||
      c.code === 'PAYROLL_MECHANIC' ||
      c.code === 'PAYROLL' ||
      c.name.toLowerCase().startsWith('зп ');

    if (isPayroll) {
      if (!addedPayroll) {
        list.push({ id: payrollId, name: 'Зарплата (ФОТ)' });
        addedPayroll = true;
      }
      continue;
    }

    list.push({ id: c.id, name: c.name });
  }

  return list;
}

export function cleanExpenseDescription(rawText: string | null | undefined): string {
  if (!rawText) return 'Расход';
  let t = rawText.trim();
  t = t.replace(/[,.]?\s*НДС\s*(не\s*облагается|исчислен|включен)?/gi, '');
  t = t.replace(/[,.]?\s*В\s*том\s*числе\s*НДС[^\n.,]*/gi, '');
  t = t.replace(/[,.]?\s*без\s*налога\s*\(?НДС\)?/gi, '');
  if (/перевод\s+собственных\s+средств/i.test(t)) {
    return 'Перевод собственных средств';
  }
  if (/комиссия\s+банка|плата\s+за\s+обслуживание|за\s+входящий\s+перевод/i.test(t)) {
    return 'Комиссия банка';
  }
  if (/фссп|исполнительн|\/\/взп\/\/|\/\/ип\d+/i.test(t)) {
    return t
      .replace(/\/\/ВЗП\/\/\s*/gi, 'ФССП · ')
      .replace(/\/\/ИП[^\/]+\/\/\s*/gi, 'ФССП · ')
      .replace(/удержание\s+из\s+заработной\s+платы/gi, 'Удержание из ЗП')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  t = t.replace(/\s*р\/с\s*\d+/gi, '');
  t = t.replace(/\s*счет\s*№?\s*\d+/gi, '');
  t = t.replace(/\s*ИНН\s*\d+/gi, '');
  t = t.replace(/\s*БИК\s*\d+/gi, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || 'Расход';
}

export function resolveExpenseCategory(title: string, rawCatName?: string | null): string {
  if (
    rawCatName &&
    rawCatName !== 'Прочие расходы' &&
    rawCatName !== 'Списание с Р/С (API)' &&
    rawCatName !== 'Расход'
  ) {
    return rawCatName;
  }
  const s = (title || '').toLowerCase();
  if (/фссп|исполнит|взп|судебн|пристав|удержан.*зарплат/i.test(s))
    return 'ФССП / Исполнительные листы';
  if (/гсм|топлив|бензин|газ|азс|лукойл|газпром/i.test(s)) return 'ГСМ / Топливо';
  if (/комисси|плата\s*за|тариф|обслуживан/i.test(s)) return 'Комиссия банка';
  if (/перевод\s*собственн|между\s*счетами/i.test(s)) return 'Перевод между кошельками';
  if (/зарплат|фот|аванс|оплат.*труд|подотчет/i.test(s)) return 'ФОТ / Зарплата';
  if (/кредит|лизинг|процент|заем/i.test(s)) return 'Кредит / Лизинг';
  if (/запчаст|ремонт|сервис|сто|шино|масло|фильтр/i.test(s)) return 'Запчасти / ТО';
  if (/налог|енс|фнс|страхов.*взнос/i.test(s)) return 'Налоги';
  if (/аренда|офис|связь|интернет/i.test(s)) return 'Аренда и связь';
  return 'Прочий расход';
}

export function detectBrandFromText(text: string): string {
  const s = (text || '').toLowerCase();
  if (s.includes('валдай')) return 'valday';
  if (s.includes('газел') || s.includes('next') || s.includes('бизнес')) return 'gazelle';
  if (s.includes('нива') || s.includes('niva') || s.includes('клиент')) return 'client';
  if (
    s.includes('масло') ||
    s.includes('фильтр') ||
    s.includes('гсм') ||
    s.includes('тосол') ||
    s.includes('антифриз') ||
    s.includes('жидкост') ||
    s.includes('смазк')
  )
    return 'consumables';
  if (
    s.includes('fuso') ||
    s.includes('фусо') ||
    s.includes('canter') ||
    s.includes('кантер') ||
    s.includes('мицубиси') ||
    s.includes('митсубиши')
  )
    return 'canter';
  return 'canter';
}

export function formatTxTime(dStr: string | Date | null | undefined, period: PeriodMode): string {
  if (!dStr) return '—';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return '—';
  if (period === 'day') {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export function pickBestLinkableOrders(orders: LinkableOrderItem[], opAmount: number): string[] {
  if (orders.length === 0) return [];

  const exactSingle = orders.find(
    (o) => !o.is_already_linked && Math.abs(parseFloat(String(o.amount || '0')) - opAmount) < 0.01,
  );
  if (exactSingle) return [exactSingle.id];

  const available = orders.filter((o) => !o.is_already_linked);
  let foundPair: string[] | null = null;
  for (let i = 0; i < available.length; i++) {
    const ordI = available[i];
    if (!ordI) continue;
    for (let j = i + 1; j < available.length; j++) {
      const ordJ = available[j];
      if (!ordJ) continue;
      const sumAmt =
        parseFloat(String(ordI.amount || '0')) + parseFloat(String(ordJ.amount || '0'));
      if (Math.abs(sumAmt - opAmount) < 0.01) {
        if (ordI.counterparty?.name && ordI.counterparty?.name === ordJ.counterparty?.name) {
          return [ordI.id, ordJ.id];
        }
        if (!foundPair) {
          foundPair = [ordI.id, ordJ.id];
        }
      }
    }
    if (foundPair) break;
  }

  if (foundPair) return foundPair;

  const best =
    orders.find((o) => !o.is_already_linked && (o.is_match_amount || o.is_match_date)) || orders[0];
  return best ? [best.id] : [];
}
