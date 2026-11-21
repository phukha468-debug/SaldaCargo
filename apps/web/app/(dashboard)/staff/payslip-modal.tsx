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
  lifecycle_status?: string | null;
  trip?: {
    id: string;
    trip_number: number;
    vehicle_label?: string;
    driver_name?: string;
    driver?: { id: string; name: string } | null;
  } | null;
  service_order?: {
    id: string;
    order_number: number;
    vehicle_label?: string;
  } | null;
};

const ADVANCE_CATEGORY_ID = 'a0000000-0000-0000-0000-000000000001';
const SALARY_CATEGORY_IDS = [
  'd79213ee-3bc6-4433-b58a-ca7ea1040d00', // Водитель
  '18792fa8-fda8-472d-8e04-e19d2c6c053c', // Грузчик
  '3d174f9f-34c2-4bc8-a3a9-d82f96f85bf6', // Механик
];

export const PayslipModal: React.FC<PayslipModalProps> = ({ user, onClose }) => {
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

  type PeriodMode = 'factual' | 'history';
  const [periodMode, setPeriodMode] = useState<PeriodMode>('factual');

  const allHistory: PayrollHistoryItem[] = user.history || [];
  const userAdvanceOffset = parseFloat(user.advance_offset || '0');

  // Хелперы фильтрации типов записей
  const isSalaryAccrual = (t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    const isPayout =
      Boolean(t.from_wallet_id) ||
      desc.startsWith('выплата зарплаты') ||
      desc.startsWith('выплата зп');
    const isAdv = t.category_id === ADVANCE_CATEGORY_ID || desc.includes('аванс');
    return SALARY_CATEGORY_IDS.includes(t.category_id) && !isPayout && !isAdv;
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
  let accruals: PayrollHistoryItem[] = [];
  let debtRepayments: PayrollHistoryItem[] = [];
  let salaryPayouts: PayrollHistoryItem[] = [];

  if (periodMode === 'factual') {
    // ⚡ ПО ФАКТУ (НА СЕГОДНЯ): Все фактически выполненные невыплаченные смены (сколько должны на момент открытия)
    accruals = allHistory.filter((t) => isSalaryAccrual(t) && t.settlement_status === 'pending');
    debtRepayments = allHistory.filter(
      (t) => isDebtRepayment(t) && t.settlement_status === 'pending',
    );
    if (debtRepayments.length === 0 && userAdvanceOffset > 0 && accruals.length > 0) {
      const sumAcc = accruals.reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
      debtRepayments = [
        {
          id: 'current-advance-offset',
          amount: Math.min(sumAcc, userAdvanceOffset).toFixed(2),
          direction: 'income',
          description: 'Зачёт аванса в счёт ЗП (По факту)',
          created_at: new Date().toISOString(),
          transaction_date: new Date().toISOString(),
          settlement_status: 'pending',
          category_id: ADVANCE_CATEGORY_ID,
          employee_confirmed: null,
        },
      ];
    }
    salaryPayouts = [];
  } else {
    // 📜 ПРОШЛЫЕ ВЫПЛАТЫ (ВСЯ ИСТОРИЯ): все фактически проведённые выплаты и закрытые смены
    accruals = allHistory.filter((t) => isSalaryAccrual(t) && t.settlement_status === 'completed');
    debtRepayments = allHistory.filter(
      (t) => isDebtRepayment(t) && t.settlement_status === 'completed',
    );
    salaryPayouts = allHistory.filter(
      (t) => isSalaryPayout(t) && t.settlement_status === 'completed',
    );
  }

  // Сортировка начислений: от свежих к старым
  accruals.sort(
    (a, b) =>
      new Date(b.transaction_date || b.created_at).getTime() -
      new Date(a.transaction_date || a.created_at).getTime(),
  );

  salaryPayouts.sort(
    (a, b) =>
      new Date(b.transaction_date || b.created_at).getTime() -
      new Date(a.transaction_date || a.created_at).getTime(),
  );

  // Подсчёт сумм за выбранный период
  const sumAccruals = accruals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumDebtRepayments = debtRepayments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumSalaryPayouts = salaryPayouts.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  // Чистый заработок за период за вычетом удержаний:
  const periodNetEarned = Math.max(0, sumAccruals - sumDebtRepayments);
  // Остаток к выдаче на руки деньгами (если выплата ещё не проводилась или проведена частично):
  const periodRemainingOnHand =
    periodMode === 'factual' ? periodNetEarned : Math.max(0, periodNetEarned - sumSalaryPayouts);

  // Фактическая сумма к выдаче для печати на бандероли/в шапке:
  const payoutToPrint =
    periodMode === 'factual'
      ? periodNetEarned
      : periodRemainingOnHand > 0
        ? periodRemainingOnHand
        : sumSalaryPayouts > 0
          ? sumSalaryPayouts
          : periodNetEarned;

  // Формирование точного заголовка периода
  let periodLabel = '';
  if (periodMode === 'factual') {
    if (accruals.length > 0) {
      const dates = accruals.map((a) => new Date(a.transaction_date || a.created_at).getTime());
      const minD = new Date(Math.min(...dates)).toLocaleDateString('ru-RU');
      const maxD = new Date(Math.max(...dates)).toLocaleDateString('ru-RU');
      periodLabel = minD === maxD ? minD : `${minD} — ${maxD}`;
    } else {
      periodLabel = `На ${new Date().toLocaleDateString('ru-RU')} (все смены выплачены)`;
    }
  } else {
    periodLabel = 'Вся история проведённых выплат';
  }

  // Расчёт подотчётных средств на руках сотрудника (включая зафиксированные переносы)
  const CASH_COLLECT_CAT = '72f677d4-84af-4d0d-a845-a1b63c7ae607';
  const historyHolds = allHistory
    .filter(
      (t) =>
        t.category_id === CASH_COLLECT_CAT &&
        t.settlement_status === 'pending' &&
        t.lifecycle_status !== 'cancelled',
    )
    .reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
  const accountableHoldAmount = Math.max(user.accountable_hold || 0, historyHolds);

  const advanceBalanceCurrent = parseFloat(user.advance_balance || '0');

  const modeBadge =
    periodMode === 'factual' ? 'РАСЧЁТ ПО ФАКТУ (НА СЕГОДНЯ)' : 'ПРОШЛЫЕ ВЫПЛАТЫ (ВСЯ ИСТОРИЯ)';

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

          {/* Переключатель: По факту на сегодня / Прошлые выплаты (вся история) */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setPeriodMode('factual')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  periodMode === 'factual'
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Все невыплаченные смены на момент открытия (сколько должны к выплате)"
              >
                <span>⚡ По факту (на сегодня)</span>
              </button>

              <button
                onClick={() => setPeriodMode('history')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  periodMode === 'history'
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Вся история проведённых выплат и закрытых смен"
              >
                <span>📜 Прошлые выплаты (вся история)</span>
              </button>
            </div>

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
          {/* ═════════════════════════════════════════════════════════════════════
              ЗОНА БАНДЕРОЛИ-КОЛЬЦА: 3 КОЛОНКИ С ВЕРТИКАЛЬНЫМИ ЛИНИЯМИ СГИБА
              ═════════════════════════════════════════════════════════════════════ */}
          <div className="relative border-2 border-slate-900 rounded-xl p-2 bg-white mb-2 shadow-xs">
            <div className="grid grid-cols-3 gap-2 items-stretch min-h-[140px]">
              {/* Левое крыло: вертикальная линия сгиба 1 и стрелка */}
              <div className="border-r-2 border-dashed border-slate-400 pr-2 text-center flex flex-col justify-center items-center h-full py-1">
                <span className="text-[9px] font-mono font-black text-slate-700 uppercase tracking-wider mb-1">
                  ✂ СГИБ 1 ➔
                </span>
                <span className="text-[7.5px] text-slate-500 leading-tight">
                  Загнуть левую треть листа внутрь по этой линии
                </span>
                <span className="text-slate-400 text-base font-black mt-1">➔</span>
              </div>

              {/* ЦЕНТРАЛЬНАЯ ВЕРТИКАЛЬНАЯ КАРТОЧКА БАНДЕРОЛИ (ЛИЦЕВАЯ СТОРОНА КОЛЬЦА) */}
              <div className="border-2 border-slate-950 rounded-xl p-2 bg-white text-center flex flex-col justify-between shadow-xs">
                <div className="border-b border-slate-300 pb-1 mb-1">
                  <span className="bg-slate-950 text-white text-[9px] font-black px-2 py-0.5 rounded tracking-wider uppercase inline-block">
                    ТК501
                  </span>
                  <div className="text-[8.5px] font-black tracking-wider uppercase text-slate-900 mt-0.5">
                    РАСЧЁТНЫЙ ЛИСТ
                  </div>
                </div>

                <div className="py-0.5">
                  <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">
                    СОТРУДНИК:
                  </div>
                  <div className="text-xs sm:text-sm font-black uppercase text-slate-950 tracking-tight leading-snug">
                    {user.name}
                  </div>
                  <div className="text-[8px] text-slate-600 font-medium truncate">
                    {rolesLabel || 'Сотрудник'}
                  </div>

                  <div className="font-mono font-black text-lg text-slate-950 bg-slate-100 border-2 border-slate-950 rounded-lg py-1 px-3 mt-1 inline-flex items-center gap-1.5">
                    <span>{payoutToPrint.toLocaleString('ru-RU')} ₽</span>
                    {periodRemainingOnHand === 0 && periodNetEarned > 0 && sumSalaryPayouts > 0 && (
                      <span className="text-[7.5px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded tracking-wide uppercase">
                        ВЫПЛАЧЕНО
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-300 pt-1 mt-1 text-[8px] font-bold text-slate-600 font-mono">
                  {periodLabel}
                </div>
              </div>

              {/* Правое крыло: вертикальная линия сгиба 2 и стрелка */}
              <div className="border-l-2 border-dashed border-slate-400 pl-2 text-center flex flex-col justify-center items-center h-full py-1">
                <span className="text-[9px] font-mono font-black text-slate-700 uppercase tracking-wider mb-1">
                  ⬅ СГИБ 2 ✂
                </span>
                <span className="text-[7.5px] text-slate-500 leading-tight">
                  Загнуть правую треть листа внутрь по этой линии
                </span>
                <span className="text-slate-400 text-base font-black mt-1">⬅</span>
              </div>
            </div>

            {/* Подсказка горизонтального оборота вокруг денег */}
            <div className="mt-1.5 pt-1 border-t border-dashed border-slate-300 text-center select-none">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">
                ✂ ── ГОРИЗОНТАЛЬНАЯ ЛИНИЯ ОБОРОТА (ОБЕРНУТЬ ПОЛУЧЕННУЮ ПОЛОСУ ВОКРУГ ДЕНЕГ) ── ✂
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
                {periodMode === 'factual'
                  ? 'Все фактически невыплаченные смены на момент открытия листа расчёта'
                  : 'Архив всех проведённых выплат и закрытых смен'}
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

          {Boolean(accountableHoldAmount > 0) && (
            <div className="bg-amber-50 print:bg-white p-1.5 rounded-lg border border-amber-300 print:border-slate-800 flex items-center justify-between text-[9.5px]">
              <span className="text-amber-950 print:text-slate-900 font-black flex items-center gap-1.5">
                <span>💵</span>
                <span>Подотчётные средства на руках (подлежат сдаче в кассу компании):</span>
              </span>
              <span className="font-mono font-black text-amber-950 print:text-slate-950 px-2 py-0.5 border border-amber-400 print:border-slate-800 rounded bg-white">
                {accountableHoldAmount.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          )}

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
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                          <span>{item.description || 'Начисление за смену / рейс'}</span>
                          {/* Машина и водитель рейса — в одну строчку справа от описания */}
                          {item.trip &&
                            (item.trip.vehicle_label ||
                              item.trip.driver_name ||
                              item.trip.driver?.name) && (
                              <span className="inline-flex items-center gap-1.5 shrink-0">
                                {item.trip.vehicle_label && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                    🚚 {item.trip.vehicle_label}
                                  </span>
                                )}
                                {(item.trip.driver_name || item.trip.driver?.name) && (
                                  <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                    👤 {item.trip.driver_name || item.trip.driver?.name}
                                  </span>
                                )}
                              </span>
                            )}
                        </div>
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
                  {periodRemainingOnHand > 0
                    ? 'ИТОГО К ВЫПЛАТЕ НА РУКИ:'
                    : periodNetEarned > 0
                      ? 'ВЫПЛАЧЕНО В ПОЛНОМ ОБЪЁМЕ:'
                      : 'НЕТ НАЧИСЛЕНИЙ К ВЫПЛАТЕ:'}
                </div>
                <div className="text-[9px] text-slate-600">
                  {periodRemainingOnHand > 0
                    ? 'Сумма к выдаче деньгами за отчётный период'
                    : periodNetEarned > 0
                      ? `Зарплата за выбранный период полностью выдана деньгами (остаток: 0 ₽)`
                      : 'За выбранный период у сотрудника нет отработанных смен'}
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
