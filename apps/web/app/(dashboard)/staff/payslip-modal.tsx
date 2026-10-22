'use client';

import React from 'react';
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

  const allHistory: PayrollHistoryItem[] = user.history || [];

  // Фильтруем историю ТОЛЬКО ЗА ВЫБРАННЫЙ (ТЕКУЩИЙ) МЕСЯЦ
  const currentMonthHistory = allHistory.filter((t) => {
    const rawDate = t.transaction_date || t.created_at;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    return d.getFullYear() === year && d.getMonth() + 1 === monthNumber;
  });

  // 1. НАЧИСЛЕНО ЗА МЕСЯЦ (Заработок за рейсы / заказ-наряды)
  // Это транзакции категорий зарплаты без списаний из кошелька (from_wallet_id === null)
  // и не являющиеся операциями выплаты/аванса.
  const accruals = currentMonthHistory.filter((t) => {
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

  // 2. ПОЛУЧЕННЫЕ АВАНСЫ / ДОЛГИ В ТЕКУЩЕМ МЕСЯЦЕ (Сотрудник взял в долг)
  const advancesGiven = currentMonthHistory.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    return (
      t.category_id === ADVANCE_CATEGORY_ID &&
      t.direction === 'expense' &&
      !desc.startsWith('зачёт аванса')
    );
  });

  // 3. ПОГАШЕНИЕ ДОЛГА / ЗАЧЁТ АВАНСА В ТЕКУЩЕМ МЕСЯЦЕ (Сотрудник гасил долг из ЗП)
  const debtRepayments = currentMonthHistory.filter((t) => {
    const desc = (t.description || '').toLowerCase();
    return (
      (t.category_id === ADVANCE_CATEGORY_ID && t.direction === 'income') ||
      desc.startsWith('зачёт аванса') ||
      desc.includes('погашение долга') ||
      desc.includes('зачтено в счёт зп')
    );
  });

  // 4. ФАКТИЧЕСКИЕ ВЫПЛАТЫ ЗАРПЛАТЫ ДЕНЬГАМИ НА РУКИ / КАРТУ В ТЕКУЩЕМ МЕСЯЦЕ
  const salaryPayouts = currentMonthHistory.filter((t) => {
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

  // Подсчёт сумм за текущий месяц
  const sumAccruals = accruals.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumDebtRepayments = debtRepayments.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumSalaryPayouts = salaryPayouts.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
  const sumAdvancesGiven = advancesGiven.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  // Значения из агрегации API пользователя
  const earnedMonthTotal = parseFloat(user.earned || '0');
  const paidMonthTotal = parseFloat(user.paid || '0');
  const advanceOffsetTotal = parseFloat(user.advance_offset || '0');
  const advanceBalanceCurrent = parseFloat(user.advance_balance || '0');
  const netPayoutTotal = parseFloat(user.payout || '0');

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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-6 print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Панель действий вверху (не печатается) */}
      <div className="w-full max-w-4xl bg-slate-900 text-white rounded-2xl p-3 mb-4 flex items-center justify-between shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <div>
            <h3 className="font-bold text-sm">Расчётный листок: {user.name}</h3>
            <p className="text-xs text-emerald-400 font-bold">
              Только за {monthName} {year} г. (строго текущий месяц)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl cursor-pointer shadow flex items-center gap-1.5 transition active:scale-95"
          >
            <span>Печать / Сохранить в PDF</span>
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition"
          >
            ✕ Закрыть
          </button>
        </div>
      </div>

      {/* Лист А4 Расчетного листка */}
      <div className="w-full max-w-4xl bg-white text-slate-950 p-6 sm:p-10 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-4 font-sans text-xs border border-slate-200 print:border-none space-y-4">
        {/* Шапка организации */}
        <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
          <div>
            <div className="inline-block bg-indigo-900 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider mb-1">
              Официальный расчётный листок (ТК РФ)
            </div>
            <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900">
              РАСЧЁТНЫЙ ЛИСТОК ЗА {monthName.toUpperCase()} {year} Г.
            </h1>
            <div className="text-[11px] text-slate-700 mt-0.5">
              <strong>Работодатель / Организация:</strong> ИП Нигамедьянов Александр Сергеевич
            </div>
            <div className="text-[10px] text-slate-500">
              ИНН: 660704814106 | ОГРНИП: 321665800053976 | Свердловская обл., г. Верхняя Салда
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div className="font-mono font-black text-slate-900 text-xs">ТК501 СИСТЕМА УЧЁТА</div>
            <div className="text-[10px] text-slate-500">
              Дата формирования: {new Date().toLocaleDateString('ru-RU')}
            </div>
            <div className="text-[9.5px] font-bold text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
              Период: {monthName} {year}
            </div>
          </div>
        </div>

        {/* Данные сотрудника */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Сотрудник:</div>
            <div className="font-black text-slate-950 text-xs mt-0.5">{user.name}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Должность:</div>
            <div className="font-bold text-slate-800 mt-0.5">{rolesLabel || 'Сотрудник'}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Телефон:</div>
            <div className="font-mono font-medium text-slate-700 mt-0.5">
              {user.phone || 'Не указан'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Закреплённое ТС:</div>
            <div className="font-bold text-slate-900 mt-0.5">
              {user.asset
                ? `${user.asset.short_name} (${user.asset.reg_number})`
                : 'Без постоянного ТС'}
            </div>
          </div>

          {user.is_officially_employed && (
            <div className="col-span-2 md:col-span-4 pt-2 border-t border-slate-200 text-emerald-900 text-[10.5px] flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold">
                💼 Трудовой договор (ТК РФ): Оклад{' '}
                {parseFloat(user.official_salary_amount || '0').toLocaleString('ru-RU')} ₽ (день
                выплаты: {user.official_salary_day || 10})
              </span>
              {user.has_court_orders && (
                <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-black border border-rose-300">
                  ⚖️ Исполнительный лист (алименты/ФССП): {user.court_order_pct}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            РАЗДЕЛ 1: НАЧИСЛЕНО ЗА МЕСЯЦ (ЗЕЛЕНЫЙ БЛОК)
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center bg-emerald-700 text-white px-3 py-2 rounded-xl shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🟢</span>
              <div>
                <span className="font-black uppercase tracking-wide text-xs">
                  1. НАЧИСЛЕНО ЗА {monthName.toUpperCase()}
                </span>
                <span className="text-[10px] text-emerald-200 ml-2">
                  (Заработная плата за выполненные рейсы и заказ-наряды)
                </span>
              </div>
            </div>
            <span className="font-mono font-black text-sm text-white">
              +{(sumAccruals || earnedMonthTotal).toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <table className="w-full text-left text-[11px] border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-[10px] uppercase font-bold">
              <tr>
                <th className="p-2 w-24">Дата</th>
                <th className="p-2">Рейс / Заказ-наряд / Основание начисления</th>
                <th className="p-2 text-center w-28">Статус</th>
                <th className="p-2 text-right w-32">Начислено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accruals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center text-slate-400 italic">
                    В месяце {monthName} {year} начислений не зафиксировано
                  </td>
                </tr>
              ) : (
                accruals.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.transaction_date || item.created_at).toLocaleDateString(
                        'ru-RU',
                      )}
                    </td>
                    <td className="p-2 font-medium text-slate-800">
                      {item.description || 'Начисление за смену / рейс'}
                    </td>
                    <td className="p-2 text-center whitespace-nowrap">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          item.settlement_status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}
                      >
                        {item.settlement_status === 'completed' ? 'Закрыт' : 'К оплате'}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                      +{parseFloat(item.amount || '0').toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {accruals.length > 0 && (
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="p-2 text-right text-slate-600">
                    Всего начислено за {monthName}:
                  </td>
                  <td className="p-2 text-right font-mono font-black text-emerald-800">
                    +{sumAccruals.toLocaleString('ru-RU')} ₽
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            РАЗДЕЛ 2 И РАЗДЕЛ 3: ЧЁТКИЕ РАЗДЕЛИТЕЛИ ГДЕ ДОЛГ, А ГДЕ ВЫПЛАТА ЗП
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── РАЗДЕЛ 2: ПОГАШЕНИЕ ДОЛГА / ЗАЧЁТ АВАНСОВ ──────────────────── */}
          <div className="space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center bg-amber-600 text-white px-3 py-2 rounded-xl shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🤝</span>
                  <div>
                    <div className="font-black uppercase tracking-wide text-xs">
                      2. ПОГАШЕНИЕ ДОЛГА (ВЗАИМОЗАЧЁТ)
                    </div>
                    <div className="text-[9.5px] text-amber-100">
                      Сотрудник гасил долг / удержано авансов
                    </div>
                  </div>
                </div>
                <span className="font-mono font-black text-sm text-white">
                  -{(sumDebtRepayments || advanceOffsetTotal).toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="border-2 border-amber-200 rounded-xl overflow-hidden mt-1.5 bg-amber-50/20">
                <table className="w-full text-left text-[10.5px]">
                  <thead className="bg-amber-100/70 text-amber-900 border-b border-amber-200 text-[9.5px] uppercase font-bold">
                    <tr>
                      <th className="p-1.5">Дата</th>
                      <th className="p-1.5">Операция погашения</th>
                      <th className="p-1.5 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 bg-white">
                    {debtRepayments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-2.5 text-center text-slate-400 italic">
                          В {monthName} удержаний и погашений долга не было
                        </td>
                      </tr>
                    ) : (
                      debtRepayments.map((d, idx) => (
                        <tr key={d.id || idx}>
                          <td className="p-1.5 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(d.transaction_date || d.created_at).toLocaleDateString(
                              'ru-RU',
                            )}
                          </td>
                          <td className="p-1.5 font-semibold text-amber-950">
                            {d.description || 'Погашение долга из зарплаты'}
                          </td>
                          <td className="p-1.5 text-right font-mono font-black text-amber-900 whitespace-nowrap">
                            -{parseFloat(d.amount || '0').toLocaleString('ru-RU')} ₽
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Справочная плашка остатка долга */}
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-300 flex items-center justify-between text-[11px] mt-1.5">
              <span className="text-amber-950 font-bold">
                Остаток долга по авансам на конец месяца:
              </span>
              <span className="font-mono font-black text-amber-900 text-xs">
                {advanceBalanceCurrent.toLocaleString('ru-RU')} ₽
              </span>
            </div>
          </div>

          {/* ── РАЗДЕЛ 3: ВЫДАННАЯ ЗАРПЛАТА НА РУКИ / КАРТУ ────────────────── */}
          <div className="space-y-1.5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center bg-blue-700 text-white px-3 py-2 rounded-xl shadow-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">💵</span>
                  <div>
                    <div className="font-black uppercase tracking-wide text-xs">
                      3. ВЫДАНА ЗАРПЛАТА (НА РУКИ / КАРТУ)
                    </div>
                    <div className="text-[9.5px] text-blue-100">
                      Деньги, фактически полученные сотрудником
                    </div>
                  </div>
                </div>
                <span className="font-mono font-black text-sm text-white">
                  {(sumSalaryPayouts || paidMonthTotal).toLocaleString('ru-RU')} ₽
                </span>
              </div>

              <div className="border-2 border-blue-200 rounded-xl overflow-hidden mt-1.5 bg-blue-50/20">
                <table className="w-full text-left text-[10.5px]">
                  <thead className="bg-blue-100/70 text-blue-900 border-b border-blue-200 text-[9.5px] uppercase font-bold">
                    <tr>
                      <th className="p-1.5">Дата</th>
                      <th className="p-1.5">Способ выплаты / Реквизиты</th>
                      <th className="p-1.5 text-right">Выдано</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 bg-white">
                    {salaryPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-2.5 text-center text-slate-400 italic">
                          Выплат зарплаты в месяце {monthName} не зафиксировано
                        </td>
                      </tr>
                    ) : (
                      salaryPayouts.map((p, idx) => (
                        <tr key={p.id || idx}>
                          <td className="p-1.5 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(p.transaction_date || p.created_at).toLocaleDateString(
                              'ru-RU',
                            )}
                          </td>
                          <td className="p-1.5 font-semibold text-blue-950">
                            {p.description || 'Выплата зарплаты (Касса / Банк)'}
                          </td>
                          <td className="p-1.5 text-right font-mono font-black text-blue-900 whitespace-nowrap">
                            {parseFloat(p.amount || '0').toLocaleString('ru-RU')} ₽
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Если в этом месяце выдавались новые авансы */}
            {sumAdvancesGiven > 0 ? (
              <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 flex items-center justify-between text-[11px] mt-1.5">
                <span className="text-purple-900 font-bold">
                  Взято новых авансов в этом месяце:
                </span>
                <span className="font-mono font-black text-purple-900 text-xs">
                  {sumAdvancesGiven.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            ) : (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10px] text-slate-500 italic text-center mt-1.5">
                Выдано строго по ведомости за отработанные дни
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════════
            РАЗДЕЛ 4: ИТОГОВЫЙ БАЛАНС И ОСТАТОК К ВЫПЛАТЕ НА ТЕКУЩИЙ МОМЕНТ
            ═════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 border-2 border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-800 text-xs">
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 font-bold uppercase">1. Начислено:</div>
              <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                +{(sumAccruals || earnedMonthTotal).toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 font-bold uppercase">
                2. Зачтено в счёт долга:
              </div>
              <div className="text-sm font-black font-mono text-amber-400 mt-0.5">
                -{(sumDebtRepayments || advanceOffsetTotal).toLocaleString('ru-RU')} ₽
              </div>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <div className="text-[10px] text-slate-400 font-bold uppercase">
                3. Уже выплачено на руки:
              </div>
              <div className="text-sm font-black font-mono text-blue-300 mt-0.5">
                -{(sumSalaryPayouts || paidMonthTotal).toLocaleString('ru-RU')} ₽
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-400">
                ИТОГОВЫЙ ОСТАТОК К ВЫПЛАТЕ НА РУКИ:
              </div>
              <div className="text-[10px] text-slate-400">
                Сумма к выдаче деньгами с учётом всех погашений долгов и ранее выплаченных сумм
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 self-end sm:self-auto">
              {netPayoutTotal.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>

        {/* Подписи сторон */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-slate-300 text-[11px]">
          <div className="space-y-6">
            <div>
              <strong>Работодатель / Руководитель:</strong>
              <div className="text-slate-600 text-[10px]">ИП Нигамедьянов А.С.</div>
            </div>
            <div className="border-b border-slate-900 w-52 text-center text-[10px] text-slate-400">
              / Нигамедьянов А.С. /
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <strong>С расчётом за {monthName} ознакомлен(а):</strong>
              <div className="text-slate-600 text-[10px]">{user.name}</div>
            </div>
            <div className="border-b border-slate-900 w-52 text-center text-[10px] text-slate-400">
              / Подпись сотрудника /
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
