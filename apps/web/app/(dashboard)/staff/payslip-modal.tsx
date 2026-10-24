'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PayrollUser } from './page';

interface PayslipModalProps {
  user: PayrollUser;
  monthName: string;
  monthNumber: number; // 1..12
  year: number;
  onClose: () => void;
}

type PayrollHistoryItem = NonNullable<PayrollUser['history']>[number] & {
  from_wallet?: { id: string; name: string; type: string } | null;
  transaction_date?: string | null;
};

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // Водитель
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // Грузчик
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // Механик
];

/**
 * Расчёт четвергового недельного цикла выплат:
 * - Срез делается в четверг вечером (23:59:59.999).
 * - Всё отработано с прошлой пятницы (00:00) по этот четверг (23:59).
 * - Пятница переносится на следующую неделю.
 */
function getThursdayCycle(refDate = new Date()) {
  const d = new Date(refDate);
  const day = d.getDay(); // 0=Вс, 1=Пн, 2=Вт, 3=Ср, 4=Чт, 5=Пт, 6=Сб
  // Если сегодня Чт (4), то последний расчетный день — сегодня.
  // Если Пт (5) или Сб (6) — последний расчетный Чт был (day - 4) назад.
  // Если Вс (0)..Ср (3) — последний расчетный Чт был (day + 3) назад.
  const diffToThu = day >= 4 ? day - 4 : day + 3;

  const endThu = new Date(d);
  endThu.setDate(d.getDate() - diffToThu);
  endThu.setHours(23, 59, 59, 999);

  const startFri = new Date(endThu);
  startFri.setDate(endThu.getDate() - 6);
  startFri.setHours(0, 0, 0, 0);

  return {
    start: startFri,
    end: endThu,
    label: `${startFri.toLocaleDateString('ru-RU')} — ${endThu.toLocaleDateString('ru-RU')}`,
  };
}

export const PayslipModal: React.FC<PayslipModalProps> = ({
  user,
  monthName,
  monthNumber,
  year,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('payslip-modal-open');
    return () => {
      document.body.classList.remove('payslip-modal-open');
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Авто-определение типа автомобиля: Валдай (по факту) или Газель (Чт-срез)
  const isValdayDriver = Boolean(
    user.asset?.short_name?.toLowerCase().includes('валдай') ||
    (user.roles?.includes('driver') && user.asset?.short_name?.toLowerCase().includes('валдай')),
  );

  type PeriodMode = 'valday' | 'gazelle' | 'custom' | 'month';
  const [periodMode, setPeriodMode] = useState<PeriodMode>(() =>
    isValdayDriver ? 'valday' : 'gazelle',
  );

  // Для произвольного диапазона дат (по умолчанию последние 14 дней)
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const now = new Date();
  const weekCycle = getThursdayCycle(now);

  const allHistory: PayrollHistoryItem[] = user.history || [];
  const userDebt = parseFloat(user.debt || '0');
  const userAdvanceOffset = parseFloat(user.advance_offset || '0');

  // Хелперы фильтрации типов записей
  const isSalaryAccrual = (t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    const isPayout =
      Boolean(t.from_wallet_id) ||
      desc.startsWith('выплата зарплаты') ||
      desc.startsWith('выплата зп');
    const isAdv = t.category_id === ADVANCE_CATEGORY_ID || desc.includes('аванс');
    return (
      (SALARY_CATEGORY_IDS.includes(t.category_id) || t.direction === 'expense') &&
      !isPayout &&
      !isAdv
    );
  };

  const isDebtRepayment = (t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    return (
      (t.category_id === ADVANCE_CATEGORY_ID && t.direction === 'income') ||
      desc.startsWith('зачёт аванса') ||
      desc.includes('погашение долга') ||
      desc.includes('зачтено в счёт зп')
    );
  };

  const isSalaryPayout = (t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    const isAdvance = t.category_id === ADVANCE_CATEGORY_ID && !desc.startsWith('выплата');
    return (
      (Boolean(t.from_wallet_id) ||
        desc.startsWith('выплата зарплаты') ||
        desc.startsWith('выплата зп') ||
        (t.settlement_status === 'completed' && desc.includes('выплата'))) &&
      !isAdvance
    );
  };

  // 1. НАЧИСЛЕНО (Заработок за рейсы / заказ-наряды)
  // В недельном режиме:
  // Если у сотрудника есть невыплаченные смены (pending), именно они составляют текущий расчётный лист к выплате в пятницу!
  // Прошлая выплата за пятницу (которая закрывала прошлую неделю) не должна смешиваться с новыми сменами.
  let accruals: PayrollHistoryItem[] = [];
  let debtRepayments: PayrollHistoryItem[] = [];
  let salaryPayouts: PayrollHistoryItem[] = [];

  // Хелпер: выплата или зачёт в прошлую пятницу (день закрытия старой недели)
  const isOldFridayAction = (rawDate: string | null | undefined) => {
    if (!rawDate) return false;
    const d = new Date(rawDate);
    return (
      d.getFullYear() === weekCycle.start.getFullYear() &&
      d.getMonth() === weekCycle.start.getMonth() &&
      d.getDate() === weekCycle.start.getDate()
    );
  };

  if (periodMode === 'valday') {
    // 🚛 ВАЛДАЙ: По факту / все невыплаченные рейсы без отсечения четвергом
    if (userDebt > 0) {
      accruals = allHistory.filter((t) => isSalaryAccrual(t) && t.settlement_status === 'pending');
      if (accruals.length === 0) {
        accruals = allHistory.filter(
          (t) =>
            isSalaryAccrual(t) && new Date(t.transaction_date || t.created_at) >= weekCycle.start,
        );
      }
      debtRepayments = allHistory.filter(
        (t) =>
          isDebtRepayment(t) &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) > weekCycle.start,
      );
      if (debtRepayments.length === 0 && userAdvanceOffset > 0) {
        debtRepayments = [
          {
            id: 'current-advance-offset',
            amount: userAdvanceOffset.toFixed(2),
            direction: 'income',
            description: 'Зачёт аванса в счёт ЗП за текущий расчёт',
            created_at: new Date().toISOString(),
            transaction_date: new Date().toISOString(),
            settlement_status: 'pending',
            category_id: ADVANCE_CATEGORY_ID,
            employee_confirmed: null,
          },
        ];
      }
      salaryPayouts = allHistory.filter(
        (t) =>
          isSalaryPayout(t) &&
          t.settlement_status === 'completed' &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) > weekCycle.start,
      );
    } else {
      accruals = allHistory.filter(
        (t) =>
          isSalaryAccrual(t) && new Date(t.transaction_date || t.created_at) >= weekCycle.start,
      );
      debtRepayments = allHistory.filter(
        (t) =>
          isDebtRepayment(t) &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) >= weekCycle.start,
      );
      salaryPayouts = allHistory.filter(
        (t) =>
          isSalaryPayout(t) &&
          t.settlement_status === 'completed' &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) >= weekCycle.start,
      );
    }
  } else if (periodMode === 'gazelle') {
    // 🚚 ГАЗЕЛЬ: Четверговый срез (Пт 00:00 - Чт 23:59:59)
    if (userDebt > 0) {
      accruals = allHistory.filter((t) => {
        if (!isSalaryAccrual(t)) return false;
        if (t.settlement_status !== 'pending') return false;
        const rawDate = t.transaction_date || t.created_at;
        if (!rawDate) return true;
        return new Date(rawDate) <= weekCycle.end;
      });
      if (accruals.length === 0) {
        accruals = allHistory.filter(
          (t) => isSalaryAccrual(t) && t.settlement_status === 'pending',
        );
      }
      debtRepayments = allHistory.filter(
        (t) =>
          isDebtRepayment(t) &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) > weekCycle.start &&
          new Date(t.transaction_date || t.created_at) <= weekCycle.end,
      );
      if (debtRepayments.length === 0 && userAdvanceOffset > 0) {
        debtRepayments = [
          {
            id: 'current-advance-offset',
            amount: userAdvanceOffset.toFixed(2),
            direction: 'income',
            description: 'Зачёт аванса в счёт ЗП (Чт-срез)',
            created_at: new Date().toISOString(),
            transaction_date: new Date().toISOString(),
            settlement_status: 'pending',
            category_id: ADVANCE_CATEGORY_ID,
            employee_confirmed: null,
          },
        ];
      }
      salaryPayouts = allHistory.filter(
        (t) =>
          isSalaryPayout(t) &&
          t.settlement_status === 'completed' &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) > weekCycle.start &&
          new Date(t.transaction_date || t.created_at) <= weekCycle.end,
      );
    } else {
      accruals = allHistory.filter(
        (t) =>
          isSalaryAccrual(t) &&
          new Date(t.transaction_date || t.created_at) >= weekCycle.start &&
          new Date(t.transaction_date || t.created_at) <= weekCycle.end,
      );
      debtRepayments = allHistory.filter(
        (t) =>
          isDebtRepayment(t) &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) >= weekCycle.start &&
          new Date(t.transaction_date || t.created_at) <= weekCycle.end,
      );
      salaryPayouts = allHistory.filter(
        (t) =>
          isSalaryPayout(t) &&
          t.settlement_status === 'completed' &&
          !isOldFridayAction(t.transaction_date || t.created_at) &&
          new Date(t.transaction_date || t.created_at) >= weekCycle.start &&
          new Date(t.transaction_date || t.created_at) <= weekCycle.end,
      );
    }
  } else if (periodMode === 'custom') {
    // 🗓️ ПРОИЗВОЛЬНЫЙ ВЫБОР ДАТ: С customStart ПО customEnd
    const sDate = new Date(customStart + 'T00:00:00');
    const eDate = new Date(customEnd + 'T23:59:59.999');
    accruals = allHistory.filter((t) => {
      if (!isSalaryAccrual(t)) return false;
      const d = new Date(t.transaction_date || t.created_at);
      return d >= sDate && d <= eDate;
    });
    debtRepayments = allHistory.filter((t) => {
      if (!isDebtRepayment(t)) return false;
      const d = new Date(t.transaction_date || t.created_at);
      return d >= sDate && d <= eDate;
    });
    salaryPayouts = allHistory.filter((t) => {
      if (!isSalaryPayout(t)) return false;
      const d = new Date(t.transaction_date || t.created_at);
      return d >= sDate && d <= eDate;
    });
  } else {
    // 📅 МЕСЯЦ (весь календарный месяц)
    const monthHistory = allHistory.filter((t) => {
      const rawDate = t.transaction_date || t.created_at;
      if (!rawDate) return false;
      const d = new Date(rawDate);
      return d.getFullYear() === year && d.getMonth() + 1 === monthNumber;
    });

    accruals = monthHistory.filter(isSalaryAccrual);
    debtRepayments = monthHistory.filter(isDebtRepayment);
    salaryPayouts = monthHistory.filter(isSalaryPayout);
  }

  // Подсчёт сумм за выбранный период
  const sumAccruals = accruals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumDebtRepayments = debtRepayments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumSalaryPayouts = salaryPayouts.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  // Остаток долга и сумма к выдаче
  const advanceBalanceCurrent = parseFloat(user.advance_balance || '0');

  // Расчёт остатка к выдаче на руки за период:
  const periodNetPayout = Math.max(0, sumAccruals - sumDebtRepayments - sumSalaryPayouts);
  const totalPayoutOnHand =
    periodMode === 'valday'
      ? userDebt > 0
        ? parseFloat(user.payout || user.debt || '0')
        : periodNetPayout
      : periodNetPayout > 0
        ? periodNetPayout
        : parseFloat(user.payout || user.debt || '0');

  // Фактическая сумма к выдаче для печати на бандероли/в шапке:
  // Если выплата уже проведена (sumSalaryPayouts > 0) и остаток обнулился,
  // берем сумму проведенной выплаты, иначе текущий расчетный остаток.
  const payoutToPrint =
    totalPayoutOnHand > 0
      ? totalPayoutOnHand
      : sumSalaryPayouts > 0
        ? sumSalaryPayouts
        : Math.max(0, sumAccruals - sumDebtRepayments);

  const actualStart =
    accruals.length > 0
      ? new Date(
          Math.min(...accruals.map((a) => new Date(a.transaction_date || a.created_at).getTime())),
        ).toLocaleDateString('ru-RU')
      : weekCycle.start.toLocaleDateString('ru-RU');
  const actualEnd =
    accruals.length > 0
      ? new Date(
          Math.max(...accruals.map((a) => new Date(a.transaction_date || a.created_at).getTime())),
        ).toLocaleDateString('ru-RU')
      : weekCycle.end.toLocaleDateString('ru-RU');
  const dynamicCycleLabel = `${actualStart} — ${actualEnd}`;

  const customLabel = `${new Date(customStart + 'T00:00:00').toLocaleDateString('ru-RU')} — ${new Date(customEnd + 'T23:59:59').toLocaleDateString('ru-RU')}`;
  const periodLabel =
    periodMode === 'custom'
      ? customLabel
      : periodMode === 'month'
        ? `${monthName.toUpperCase()} ${year} Г.`
        : dynamicCycleLabel;

  const modeBadge =
    periodMode === 'gazelle'
      ? 'НЕДЕЛЬНЫЙ РАСЧЁТ (ГАЗЕЛЬ • ЧТ-СРЕЗ)'
      : periodMode === 'valday'
        ? 'РАСЧЁТ ПО ФАКТУ (ВАЛДАЙ • МЕЖГОРОД)'
        : periodMode === 'custom'
          ? 'РАСЧЁТ ЗА ПРОИЗВОЛЬНЫЙ ПЕРИОД'
          : 'МЕСЯЧНЫЙ РАСЧЁТ';

  // Роли сотрудника
  const rolesLabel = (user.roles || [])
    .map((r: string) => {
      const map: Record<string, string> = {
        driver: 'Водитель',
        mechanic: 'Механик',
        mechanic_lead: 'Старший механик',
        loader: 'Грузчик',
        accountant: 'Бухгалтер',
        admin: 'Администратор',
        owner: 'Владелец',
      };
      return map[r] || r;
    })
    .join(', ');

  const modalContent = (
    <div id="payslip-portal-root">
      {/* ── СТИЛИ ПЕЧАТИ: АДАПТАЦИЯ К Ч/Б ПРИНТЕРУ И СТРОГО 1 СТРАНИЦЕ A4 ───── */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media print {
          /* Скрываем ВСЁ основное приложение на фоне модалки */
          body > *:not(#payslip-portal-root) {
            display: none !important;
          }
          header, footer, nav, aside {
            display: none !important;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #payslip-portal-root {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
          .payslip-modal-backdrop {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
          }
          .payslip-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}</style>

      <div className="payslip-modal-backdrop fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 print:static print:block print:w-full print:h-auto print:overflow-visible print:p-0 print:m-0 print:bg-white">
        {/* ── ПАНЕЛЬ УПРАВЛЕНИЯ (СКРЫВАЕТСЯ ПРИ ПЕЧАТИ) ───────────────────── */}
        <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-3 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="font-bold text-sm">Расчётный листок: {user.name}</h3>
              <p className="text-xs text-slate-300">
                <span className="text-amber-300 font-bold">
                  {modeBadge}: {periodLabel}
                </span>
              </p>
            </div>
          </div>

          {/* Переключатель: Газель / Валдай / Свои даты / Месяц */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex flex-wrap items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setPeriodMode('gazelle')}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  periodMode === 'gazelle'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Четверговый срез (Пт-Чт) для водителей Газелей"
              >
                🚚 Газель (Чт срез)
              </button>

              <button
                onClick={() => setPeriodMode('valday')}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  periodMode === 'valday'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Все невыплаченные рейсы без привязки к четвергу (Валдай)"
              >
                🚛 Валдай (По факту)
              </button>

              <button
                onClick={() => setPeriodMode('custom')}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  periodMode === 'custom'
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Выбрать любые произвольные даты"
              >
                🗓️ Выбор дат
              </button>

              <button
                onClick={() => setPeriodMode('month')}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  periodMode === 'month'
                    ? 'bg-sky-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="За весь календарный месяц"
              >
                📅 Месяц
              </button>
            </div>

            {/* Выбор дат календариками для custom */}
            {periodMode === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
                <span className="text-slate-400 font-bold text-[10px]">С:</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-600 text-xs font-mono"
                />
                <span className="text-slate-400 font-bold text-[10px]">ПО:</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-600 text-xs font-mono"
                />
              </div>
            )}

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer shadow flex items-center gap-1.5 transition active:scale-95 shrink-0"
            >
              <span>🖨️ Печать/PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── КОМПАКТНЫЙ ЛИСТ A4 (100% БЕЛЫЙ ФОН, ЧЕРНЫЙ ТЕКСТ, ПОМЕЩАЕТСЯ НА 1 ЛИСТ) ── */}
        <div className="payslip-sheet w-full max-w-4xl bg-white text-slate-950 p-5 sm:p-6 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-0 font-sans text-[10px] leading-tight border border-slate-200 print:border-none space-y-2">
          {/* ═════════════════════════════════════════════════════════════════════
              ТИКУЛЬНЫЙ БЛОК БАНДЕРОЛИ (ЛИЦЕВАЯ СТОРОНА ПРИ СКЛАДЫВАНИИ ВОКРУГ ДЕНЕГ)
              Снаружи: ТК501, РАСЧЕТНЫЙ ЛИСТ, ФИО, СУММА К ВЫДАЧЕ, ДАТЫ ВЫПЛАТЫ
              ═════════════════════════════════════════════════════════════════════ */}
          <div className="border-2 border-slate-950 rounded-xl p-2.5 sm:p-3 bg-white shadow-xs">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs tracking-wider uppercase px-2 py-0.5 bg-slate-950 text-white rounded">
                  ТК501
                </span>
                <span className="font-black text-xs tracking-wide uppercase text-slate-950">
                  РАСЧЁТНЫЙ ЛИСТ
                </span>
              </div>
              <div className="text-[10px] font-bold text-slate-800">Период: {periodLabel}</div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold">
                  Сотрудник:
                </div>
                <div className="text-base sm:text-lg font-black text-slate-950 uppercase tracking-tight">
                  {user.name}
                </div>
                <div className="text-[9px] text-slate-600 font-medium">
                  {rolesLabel || 'Сотрудник'}
                  {user.asset ? ` • ${user.asset.short_name} (${user.asset.reg_number})` : ''}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[9px] uppercase tracking-wider text-slate-700 font-bold">
                  К выдаче на руки:
                </div>
                <div className="font-mono font-black text-xl sm:text-2xl text-slate-950 px-3 py-1 border-2 border-slate-950 rounded-lg bg-slate-50 inline-block mt-0.5">
                  {payoutToPrint.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>
          </div>

          {/* Пунктирная линия сгиба 1 с подсказкой */}
          <div className="relative my-1 text-center select-none">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-dashed border-slate-400"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2.5 text-[8px] font-mono text-slate-500 uppercase tracking-wider">
                ✂ - - - ЛИНИЯ СГИБА (ОБОРОТ ВОКРУГ КУПЮР) - - -
              </span>
            </div>
          </div>

          {/* Шапка организации */}
          <div className="border-b-2 border-slate-900 pb-2 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-900 text-slate-950 bg-white tracking-wider">
                  {modeBadge}
                </span>
                <span className="font-bold text-[10px] text-slate-700">
                  ИП Нигамедьянов Александр Сергеевич (ИНН: 660704814106)
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-950 mt-1">
                РАСЧЁТНЫЙ ЛИСТОК ЗА ПЕРИОД: {periodLabel}
              </h1>
              <div className="text-[9.5px] text-slate-600 italic">
                {periodMode !== 'month'
                  ? 'Расчёт за отчётный период выплат (все фактически выполненные смены)'
                  : `Полный отчётный период: 01.${String(monthNumber).padStart(2, '0')} — конец месяца`}
              </div>
            </div>

            <div className="text-right text-[10px]">
              <div className="font-mono font-black text-slate-950">ТК501 СИСТЕМА УЧЁТА</div>
              <div className="text-slate-600">Выдан: {new Date().toLocaleDateString('ru-RU')}</div>
            </div>
          </div>

          {/* Данные сотрудника (Компактная строка, белый фон) */}
          <div className="bg-white p-2 rounded-lg border border-slate-300 grid grid-cols-2 print:grid-cols-4 sm:grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="text-slate-600 font-bold">Сотрудник:</span>{' '}
              <strong className="text-slate-950">{user.name}</strong>
            </div>
            <div>
              <span className="text-slate-600 font-bold">Должность:</span>{' '}
              <span className="font-semibold text-slate-950">{rolesLabel || 'Сотрудник'}</span>
            </div>
            <div>
              <span className="text-slate-600 font-bold">Автомобиль:</span>{' '}
              <span className="font-semibold font-mono text-slate-950">
                {user.asset
                  ? `${user.asset.short_name} (${user.asset.reg_number})`
                  : 'Не закреплён'}
              </span>
            </div>
            <div>
              <span className="text-slate-600 font-bold">Телефон:</span>{' '}
              <span className="font-mono text-slate-950">{user.phone || '—'}</span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              1. НАЧИСЛЕНО ЗА ПЕРИОД (БЕЛЫЙ ФОН, РАМКА/ЧЕРНЫЙ ТЕКСТ)
              ═════════════════════════════════════════════════════════════════════ */}
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-white border-b-2 border-slate-900 px-1 py-1">
              <span className="font-black uppercase text-[10.5px] tracking-wide text-slate-950 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-900"></span>
                <span>1. НАЧИСЛЕНО ЗА ПЕРИОД (ЗАРАБОТОК ЗА РЕЙСЫ / СТО)</span>
              </span>
              <span className="font-mono font-black text-xs text-slate-950 px-2 py-0.5 border-2 border-slate-900 rounded bg-white">
                +{sumAccruals.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <table className="w-full text-left text-[9.5px] border border-slate-300 rounded-lg overflow-hidden bg-white">
              <thead className="bg-slate-50 print:bg-white text-slate-900 border-b border-slate-300 uppercase font-bold text-[8.5px]">
                <tr>
                  <th className="p-1 sm:p-1.5 w-20">Дата</th>
                  <th className="p-1 sm:p-1.5">Рейс / Заказ-наряд / Основание</th>
                  <th className="p-1 sm:p-1.5 text-center w-24">Статус</th>
                  <th className="p-1 sm:p-1.5 text-right w-28">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {accruals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-2 text-center text-slate-500 italic">
                      За выбранный период начислений не зафиксировано
                    </td>
                  </tr>
                ) : (
                  accruals.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="p-1 sm:p-1.5 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(item.transaction_date || item.created_at).toLocaleDateString(
                          'ru-RU',
                        )}
                      </td>
                      <td className="p-1 sm:p-1.5 font-medium text-slate-950">
                        {item.description || 'Начисление за смену / рейс'}
                      </td>
                      <td className="p-1 sm:p-1.5 text-center whitespace-nowrap">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-slate-400 text-slate-950 bg-white">
                          {item.settlement_status === 'completed' ? 'Закрыт' : 'К оплате'}
                        </span>
                      </td>
                      <td className="p-1 sm:p-1.5 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                        +{parseFloat(item.amount || '0').toLocaleString('ru-RU')} ₽
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {accruals.length > 0 && (
                <tfoot className="bg-white font-bold border-t-2 border-slate-900">
                  <tr>
                    <td colSpan={3} className="p-1 sm:p-1.5 text-right text-slate-700">
                      Итого начислено за отчётный период:
                    </td>
                    <td className="p-1 sm:p-1.5 text-right font-mono font-black text-slate-950">
                      +{sumAccruals.toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              2 И 3: ДВА КОЛОНОЧНЫХ БЛОКА (ДОЛГ vs ВЫПЛАТА ЗП)
              Строго в 2 колонки при печати (print:grid-cols-2) чтобы не раздувать лист!
              ═════════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 print:grid-cols-2 sm:grid-cols-2 gap-2.5">
            {/* ── 2. ПОГАШЕНИЕ ДОЛГА (ВЗАИМОЗАЧЁТ) ─────────────────────────── */}
            <div className="space-y-1">
              <div className="flex justify-between items-center bg-white border-b-2 border-slate-800 px-1 py-1">
                <span className="font-black uppercase text-[9.5px] tracking-wide text-slate-950 flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-800"></span>
                  <span>2. ПОГАШЕНИЕ ДОЛГА (ВЗАИМОЗАЧЁТ)</span>
                </span>
                <span className="font-mono font-black text-xs text-slate-950 px-1.5 py-0.5 border border-slate-800 rounded bg-white">
                  -{sumDebtRepayments.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-slate-50 print:bg-white text-slate-900 border-b border-slate-300 uppercase font-bold text-[8px]">
                    <tr>
                      <th className="p-1 w-16">Дата</th>
                      <th className="p-1">Операция погашения / удержания</th>
                      <th className="p-1 text-right w-20">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {debtRepayments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-2 text-center text-slate-500 italic">
                          Удержаний и погашений за период нет
                        </td>
                      </tr>
                    ) : (
                      debtRepayments.map((d, idx) => (
                        <tr key={d.id || idx}>
                          <td className="p-1 font-mono text-slate-600 whitespace-nowrap">
                            {new Date(d.transaction_date || d.created_at).toLocaleDateString(
                              'ru-RU',
                            )}
                          </td>
                          <td className="p-1 font-semibold text-slate-950">
                            {d.description || 'Погашение долга из зарплаты'}
                          </td>
                          <td className="p-1 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                            -{parseFloat(d.amount || '0').toLocaleString('ru-RU')} ₽
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-1.5 rounded-lg border border-slate-300 flex items-center justify-between text-[9.5px]">
                <span className="text-slate-700 font-bold">Остаток долга по авансам:</span>
                <span className="font-mono font-bold text-slate-950 px-1.5 py-0.5 border border-slate-400 rounded">
                  {advanceBalanceCurrent.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>

            {/* ── 3. ВЫДАННАЯ ЗАРПЛАТА (НА РУКИ / КАРТУ) ───────────────────── */}
            <div className="space-y-1">
              <div className="flex justify-between items-center bg-white border-b-2 border-slate-800 px-1 py-1">
                <span className="font-black uppercase text-[9.5px] tracking-wide text-slate-950 flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-800"></span>
                  <span>3. ВЫДАНА ЗАРПЛАТА (ДЕНЬГАМИ)</span>
                </span>
                <span className="font-mono font-black text-xs text-slate-950 px-1.5 py-0.5 border border-slate-800 rounded bg-white">
                  {sumSalaryPayouts.toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-[9px]">
                  <thead className="bg-slate-50 print:bg-white text-slate-900 border-b border-slate-300 uppercase font-bold text-[8px]">
                    <tr>
                      <th className="p-1 w-16">Дата</th>
                      <th className="p-1">Способ выплаты / Реквизиты</th>
                      <th className="p-1 text-right w-20">Выдано</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {salaryPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-2 text-center text-slate-500 italic">
                          Выплат денег за период не было
                        </td>
                      </tr>
                    ) : (
                      salaryPayouts.map((p, idx) => (
                        <tr key={p.id || idx}>
                          <td className="p-1 font-mono text-slate-600 whitespace-nowrap">
                            {new Date(p.transaction_date || p.created_at).toLocaleDateString(
                              'ru-RU',
                            )}
                          </td>
                          <td className="p-1 font-semibold text-slate-950">
                            {p.description || 'Выплата зарплаты'}
                          </td>
                          <td className="p-1 text-right font-mono font-bold text-slate-950 whitespace-nowrap">
                            {parseFloat(p.amount || '0').toLocaleString('ru-RU')} ₽
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-1.5 rounded-lg border border-slate-300 flex items-center justify-between text-[9.5px]">
                <span className="text-slate-700 font-bold">Фактически выдано за период:</span>
                <span className="font-mono font-bold text-slate-950 px-1.5 py-0.5 border border-slate-400 rounded">
                  {sumSalaryPayouts.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════════════
              4. ИТОГОВЫЙ БАЛАНС И ОСТАТОК К ВЫПЛАТЕ НА РУКИ
              АДАПТИРОВАНО К Ч/Б ПРИНТЕРУ: БЕЛЫЙ ФОН, ЧЕРНЫЙ ТЕКСТ, ВЫДЕЛЕНИЕ РАМКОЙ
              ═════════════════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-lg p-2.5 border-2 border-slate-900 space-y-2">
            <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-300 text-[9.5px]">
              <div>
                <div className="text-slate-600 font-semibold">1. Начислено:</div>
                <div className="font-mono font-black text-slate-950 text-xs">
                  +{sumAccruals.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div>
                <div className="text-slate-600 font-semibold">2. Зачтено в долг:</div>
                <div className="font-mono font-black text-slate-950 text-xs">
                  -{sumDebtRepayments.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div>
                <div className="text-slate-600 font-semibold">3. Выдано деньгами:</div>
                <div className="font-mono font-black text-slate-950 text-xs">
                  -{sumSalaryPayouts.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-950">
                  ИТОГО К ВЫПЛАТЕ НА РУКИ:
                </div>
                <div className="text-[9px] text-slate-600">
                  Сумма к выдаче деньгами за отчётный период (срез по Чт-вечер)
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-slate-950 px-3 py-1 border-2 border-slate-900 rounded bg-white">
                {payoutToPrint.toLocaleString('ru-RU')} ₽
              </div>
            </div>
          </div>

          {/* Подписи сторон (Компактные, строго 2 колонки) */}
          <div className="grid grid-cols-2 print:grid-cols-2 gap-6 pt-2 border-t border-slate-300 text-[9.5px]">
            <div>
              <strong className="text-slate-950">Работодатель:</strong>{' '}
              <span className="text-slate-800">ИП Нигамедьянов А.С.</span>
              <div className="pt-3 border-b border-slate-900 w-44 text-center text-[8.5px] text-slate-500">
                / Нигамедьянов А.С. /
              </div>
            </div>

            <div>
              <strong className="text-slate-950">Сотрудник:</strong>{' '}
              <span className="text-slate-800">{user.name}</span>
              <div className="pt-3 border-b border-slate-900 w-44 text-center text-[8.5px] text-slate-500">
                / Подпись сотрудника /
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};
