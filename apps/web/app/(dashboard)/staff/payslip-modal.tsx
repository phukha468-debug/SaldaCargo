'use client';

import React, { useState } from 'react';
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
  const handlePrint = () => {
    window.print();
  };

  // Режим периода: по умолчанию "week" (недельный четверговый цикл), переключатель на "month" (полный месяц)
  const [periodMode, setPeriodMode] = useState<'week' | 'month'>('week');

  const now = new Date();
  const weekCycle = getThursdayCycle(now);

  const allHistory: PayrollHistoryItem[] = user.history || [];

  // Фильтруем историю:
  // Если режим "week": строго с прошлой пятницы 00:00 по четверг 23:59 (пятница идет в след. неделю)
  // Если режим "month": за весь выбранный месяц
  const filteredHistory = allHistory.filter((t) => {
    const rawDate = t.transaction_date || t.created_at;
    if (!rawDate) return false;
    const d = new Date(rawDate);

    if (periodMode === 'week') {
      return d >= weekCycle.start && d <= weekCycle.end;
    } else {
      return d.getFullYear() === year && d.getMonth() + 1 === monthNumber;
    }
  });

  // 1. НАЧИСЛЕНО (Заработок за рейсы / заказ-наряды)
  const accruals = filteredHistory.filter((t) => {
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
  });

  // 2. ПОГАШЕНИЕ ДОЛГА / ЗАЧЁТ АВАНСА (Сотрудник гасил долг)
  const debtRepayments = filteredHistory.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    return (
      (t.category_id === ADVANCE_CATEGORY_ID && t.direction === 'income') ||
      desc.startsWith('зачёт аванса') ||
      desc.includes('погашение долга') ||
      desc.includes('зачтено в счёт зп')
    );
  });

  // 3. ФАКТИЧЕСКИ ВЫДАННАЯ ЗАРПЛАТА (Деньги на руки / карту)
  const salaryPayouts = filteredHistory.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    const isAdvance = t.category_id === ADVANCE_CATEGORY_ID && !desc.startsWith('выплата');
    return (
      (Boolean(t.from_wallet_id) ||
        desc.startsWith('выплата зарплаты') ||
        desc.startsWith('выплата зп') ||
        (t.settlement_status === 'completed' && desc.includes('выплата'))) &&
      !isAdvance
    );
  });

  // Подсчёт сумм за выбранный период
  const sumAccruals = accruals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumDebtRepayments = debtRepayments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumSalaryPayouts = salaryPayouts.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  // Остаток долга и сумма к выдаче
  const advanceBalanceCurrent = parseFloat(user.advance_balance || '0');

  // Расчёт остатка к выдаче на руки за период:
  // Если начислено больше, чем выплачено и удержано
  const periodNetPayout = Math.max(0, sumAccruals - sumDebtRepayments - sumSalaryPayouts);
  const totalPayoutOnHand =
    periodMode === 'week' ? periodNetPayout : parseFloat(user.payout || '0');

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      {/* ── ПАНЕЛЬ УПРАВЛЕНИЯ (СКРЫВАЕТСЯ ПРИ ПЕЧАТИ) ───────────────────── */}
      <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-3 mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <div>
            <h3 className="font-bold text-sm">Расчётный листок: {user.name}</h3>
            <p className="text-xs text-slate-300">
              {periodMode === 'week' ? (
                <span className="text-amber-300 font-bold">
                  🗓️ Неделя (Четверг-вечер срез): {weekCycle.label}
                </span>
              ) : (
                <span className="text-sky-300 font-bold">
                  🗓️ Полный месяц: {monthName} {year} г.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Переключатель: Неделя (срез по четвергу) / Месяц */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="bg-slate-800 p-1 rounded-xl border border-slate-700 flex items-center text-xs font-bold">
            <button
              onClick={() => setPeriodMode('week')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodMode === 'week'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Расчёт за отчётную неделю: с пятницы по четверг включительно"
            >
              ⚡ Неделя (Чт срез)
            </button>
            <button
              onClick={() => setPeriodMode('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                periodMode === 'month'
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Показать за весь календарный месяц"
            >
              📅 Весь месяц
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

      {/* ── КОМПАКТНЫЙ ЛИСТ A4 (ПОМЕЩАЕТСЯ НА ОДНУ СТРАНИЦУ) ──────────────── */}
      <div className="w-full max-w-4xl bg-white text-slate-950 p-5 sm:p-7 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-2 font-sans text-[11px] leading-tight border border-slate-200 print:border-none space-y-3">
        {/* Шапка организации */}
        <div className="border-b-2 border-slate-900 pb-2 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white tracking-wider">
                {periodMode === 'week' ? 'НЕДЕЛЬНЫЙ РАСЧЁТ (ЧТ-СРЕЗ)' : 'МЕСЯЧНЫЙ РАСЧЁТ'}
              </span>
              <span className="font-bold text-[10px] text-slate-500">
                ИП Нигамедьянов Александр Сергеевич (ИНН: 660704814106)
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-900 mt-0.5">
              РАСЧЁТНЫЙ ЛИСТОК ЗА ПЕРИОД:{' '}
              {periodMode === 'week' ? weekCycle.label : `${monthName.toUpperCase()} ${year} Г.`}
            </h1>
            <div className="text-[9.5px] text-slate-500 italic">
              {periodMode === 'week'
                ? 'Срез: по четверг вечер включительно (пятница переносится на следующую неделю)'
                : `Полный отчётный период: 01.${String(monthNumber).padStart(2, '0')} — конец месяца`}
            </div>
          </div>

          <div className="text-right text-[10px]">
            <div className="font-mono font-black text-slate-900">ТК501 СИСТЕМА УЧЁТА</div>
            <div className="text-slate-500">Выдан: {new Date().toLocaleDateString('ru-RU')}</div>
          </div>
        </div>

        {/* Данные сотрудника (Компактная строка) */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
          <div>
            <span className="text-slate-500 font-bold">Сотрудник:</span>{' '}
            <strong className="text-slate-950">{user.name}</strong>
          </div>
          <div>
            <span className="text-slate-500 font-bold">Должность:</span>{' '}
            <span className="font-semibold">{rolesLabel || 'Сотрудник'}</span>
          </div>
          <div>
            <span className="text-slate-500 font-bold">Автомобиль:</span>{' '}
            <span className="font-semibold font-mono">
              {user.asset ? `${user.asset.short_name} (${user.asset.reg_number})` : 'Не закреплён'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 font-bold">Телефон:</span>{' '}
            <span className="font-mono text-slate-700">{user.phone || '—'}</span>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            1. НАЧИСЛЕНО ЗА ПЕРИОД (ЗЕЛЁНЫЙ БЛОК)
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg">
            <span className="font-black uppercase text-[10.5px] tracking-wide flex items-center gap-1.5">
              <span>🟢</span>
              <span>1. НАЧИСЛЕНО ЗА ПЕРИОД (ЗАРАБОТОК ЗА РЕЙСЫ / СТО)</span>
            </span>
            <span className="font-mono font-black text-xs text-white">
              +{sumAccruals.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <table className="w-full text-left text-[10px] border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase font-bold text-[9px]">
              <tr>
                <th className="p-1.5 w-20">Дата</th>
                <th className="p-1.5">Рейс / Заказ-наряд / Основание</th>
                <th className="p-1.5 text-center w-24">Статус</th>
                <th className="p-1.5 text-right w-28">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accruals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-2 text-center text-slate-400 italic">
                    За выбранный период начислений не зафиксировано
                  </td>
                </tr>
              ) : (
                accruals.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="p-1.5 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.transaction_date || item.created_at).toLocaleDateString(
                        'ru-RU',
                      )}
                    </td>
                    <td className="p-1.5 font-medium text-slate-800">
                      {item.description || 'Начисление за смену / рейс'}
                    </td>
                    <td className="p-1.5 text-center whitespace-nowrap">
                      <span
                        className={`text-[8.5px] font-bold px-1 py-0.2 rounded border ${
                          item.settlement_status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {item.settlement_status === 'completed' ? 'Закрыт' : 'К оплате'}
                      </span>
                    </td>
                    <td className="p-1.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                      +{parseFloat(item.amount || '0').toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {accruals.length > 0 && (
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="p-1.5 text-right text-slate-600">
                    Итого начислено за отчётный период:
                  </td>
                  <td className="p-1.5 text-right font-mono font-black text-emerald-800">
                    +{sumAccruals.toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            2 И 3: ДВА ЧЕТКИХ КОЛОНОЧНЫХ БЛОКА (ДОЛГ vs ВЫПЛАТА ЗП)
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* ── 2. ПОГАШЕНИЕ ДОЛГА (ВЗАИМОЗАЧЁТ) ─────────────────────────── */}
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-amber-600 text-white px-2 py-1.5 rounded-lg">
              <span className="font-black uppercase text-[10px] tracking-wide flex items-center gap-1">
                <span>🤝</span>
                <span>2. ПОГАШЕНИЕ ДОЛГА (ВЗАИМОЗАЧЁТ)</span>
              </span>
              <span className="font-mono font-black text-xs text-white">
                -{sumDebtRepayments.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="border border-amber-200 rounded-lg overflow-hidden bg-amber-50/20">
              <table className="w-full text-left text-[9.5px]">
                <thead className="bg-amber-100/70 text-amber-900 border-b border-amber-200 uppercase font-bold text-[8.5px]">
                  <tr>
                    <th className="p-1 w-16">Дата</th>
                    <th className="p-1">Операция погашения / удержания</th>
                    <th className="p-1 text-right w-20">Сумма</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {debtRepayments.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-2 text-center text-slate-400 italic">
                        Удержаний и погашений за период нет
                      </td>
                    </tr>
                  ) : (
                    debtRepayments.map((d, idx) => (
                      <tr key={d.id || idx}>
                        <td className="p-1 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(d.transaction_date || d.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="p-1 font-semibold text-amber-950">
                          {d.description || 'Погашение долга из зарплаты'}
                        </td>
                        <td className="p-1 text-right font-mono font-black text-amber-900 whitespace-nowrap">
                          -{parseFloat(d.amount || '0').toLocaleString('ru-RU')} ₽
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50/90 p-1.5 rounded-lg border border-amber-300 flex items-center justify-between text-[10px]">
              <span className="text-amber-950 font-bold">Остаток долга по авансам:</span>
              <span className="font-mono font-black text-amber-900">
                {advanceBalanceCurrent.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          {/* ── 3. ВЫДАННАЯ ЗАРПЛАТА (НА РУКИ / КАРТУ) ───────────────────── */}
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-blue-700 text-white px-2 py-1.5 rounded-lg">
              <span className="font-black uppercase text-[10px] tracking-wide flex items-center gap-1">
                <span>💵</span>
                <span>3. ВЫДАНА ЗАРПЛАТА (ДЕНЬГАМИ)</span>
              </span>
              <span className="font-mono font-black text-xs text-white">
                {sumSalaryPayouts.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/20">
              <table className="w-full text-left text-[9.5px]">
                <thead className="bg-blue-100/70 text-blue-900 border-b border-blue-200 uppercase font-bold text-[8.5px]">
                  <tr>
                    <th className="p-1 w-16">Дата</th>
                    <th className="p-1">Способ выплаты / Реквизиты</th>
                    <th className="p-1 text-right w-20">Выдано</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {salaryPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-2 text-center text-slate-400 italic">
                        Выплат денег за период не было
                      </td>
                    </tr>
                  ) : (
                    salaryPayouts.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td className="p-1 font-mono text-slate-500 whitespace-nowrap">
                          {new Date(p.transaction_date || p.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="p-1 font-semibold text-blue-950">
                          {p.description || 'Выплата зарплаты'}
                        </td>
                        <td className="p-1 text-right font-mono font-black text-blue-900 whitespace-nowrap">
                          {parseFloat(p.amount || '0').toLocaleString('ru-RU')} ₽
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50/90 p-1.5 rounded-lg border border-blue-200 flex items-center justify-between text-[10px]">
              <span className="text-blue-950 font-bold">Фактически выдано за период:</span>
              <span className="font-mono font-black text-blue-900">
                {sumSalaryPayouts.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            4. ИТОГОВЫЙ БАЛАНС И ОСТАТОК К ВЫПЛАТЕ НА РУКИ
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md space-y-2 border border-slate-800">
          <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-800 text-[10px]">
            <div>
              <div className="text-slate-400">1. Начислено:</div>
              <div className="font-mono font-black text-emerald-400 text-xs">
                +{sumAccruals.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div>
              <div className="text-slate-400">2. Зачтено в долг:</div>
              <div className="font-mono font-black text-amber-400 text-xs">
                -{sumDebtRepayments.toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div>
              <div className="text-slate-400">3. Выдано деньгами:</div>
              <div className="font-mono font-black text-blue-300 text-xs">
                -{sumSalaryPayouts.toLocaleString('ru-RU')} ₽
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-amber-400">
                ИТОГО К ВЫПЛАТЕ НА РУКИ:
              </div>
              <div className="text-[9px] text-slate-400">
                Сумма к выдаче деньгами за отчётный период (срез по Чт-вечер)
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {totalPayoutOnHand.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>

        {/* Подписи сторон (Компактные) */}
        <div className="grid grid-cols-2 gap-6 pt-3 border-t border-slate-300 text-[10px]">
          <div>
            <strong>Работодатель:</strong> ИП Нигамедьянов А.С.
            <div className="pt-4 border-b border-slate-900 w-44 text-center text-[9px] text-slate-400">
              / Нигамедьянов А.С. /
            </div>
          </div>

          <div>
            <strong>Сотрудник:</strong> {user.name}
            <div className="pt-4 border-b border-slate-900 w-44 text-center text-[9px] text-slate-400">
              / Подпись сотрудника /
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
