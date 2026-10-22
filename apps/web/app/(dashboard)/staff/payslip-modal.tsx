'use client';

import React from 'react';
import type { PayrollUser } from './page';

interface PayslipModalProps {
  user: PayrollUser;
  monthName: string;
  year: number;
  onClose: () => void;
}

type PayrollHistoryItem = NonNullable<PayrollUser['history']>[number];

export const PayslipModal: React.FC<PayslipModalProps> = ({ user, monthName, year, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const history: PayrollHistoryItem[] = user.history || [];

  // 1. Начисления (доходы)
  const accruals = history.filter(
    (t: PayrollHistoryItem) =>
      t.direction === 'income' ||
      (t.category_id &&
        !['cat_advance', '10000000-0000-0000-0000-000000000003'].includes(t.category_id) &&
        !t.description?.toLowerCase().includes('выплата')),
  );

  // 2. Удержания (авансы, займы, штрафы, исполнительные листы)
  const deductions = history.filter((t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    const isAdv =
      desc.includes('аванс') ||
      desc.includes('займ') ||
      desc.includes('удержан') ||
      desc.includes('фссп') ||
      desc.includes('алимент') ||
      desc.includes('налог');
    return isAdv && t.direction === 'expense';
  });

  // 3. Выплаты (фактически выплаченная ЗП)
  const payouts = history.filter((t: PayrollHistoryItem) => {
    const desc = (t.description || '').toLowerCase();
    return (
      (desc.includes('выплата') ||
        desc.includes('зарплат') ||
        t.settlement_status === 'completed') &&
      t.direction === 'expense' &&
      !desc.includes('аванс')
    );
  });

  const totalAccrued = parseFloat(user.earned || '0');
  const totalPaid = parseFloat(user.paid || '0');
  const advanceOffset = parseFloat(user.advance_offset || '0');
  const advanceBalance = parseFloat(user.advance_balance || '0');
  const totalPayout = parseFloat(user.payout || user.debt || '0');

  // Роли на русском
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
      {/* Панель действий вверху (скрывается при печати) */}
      <div className="w-full max-w-3xl bg-slate-900 text-white rounded-2xl p-3 mb-4 flex items-center justify-between shadow-xl print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-xl">📄</span>
          <div>
            <h3 className="font-bold text-sm">Расчётный листок: {user.name}</h3>
            <p className="text-xs text-slate-400">
              Период: {monthName} {year} г.
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

      {/* Лист Расчетного листка (Формат A4 / печатный) */}
      <div className="w-full max-w-3xl bg-white text-slate-950 p-6 sm:p-10 shadow-2xl rounded-2xl print:shadow-none print:rounded-none print:p-4 font-sans text-xs border border-slate-200 print:border-none space-y-4">
        {/* Шапка организации */}
        <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-base font-black uppercase tracking-tight text-slate-900">
              РАСЧЁТНЫЙ ЛИСТОК ЗА {monthName.toUpperCase()} {year} Г.
            </h1>
            <div className="text-[11px] text-slate-700 mt-0.5">
              <strong>Организация:</strong> ИП Нигамедьянов Александр Сергеевич
            </div>
            <div className="text-[10px] text-slate-500">
              ИНН: 660704814106 | ОГРНИП: 321665800053976 | г. Верхняя Салда
            </div>
          </div>
          <div className="text-right text-[11px]">
            <div className="font-bold text-slate-900">ТК501 ERP</div>
            <div className="text-[10px] text-slate-500">
              Сформирован: {new Date().toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>

        {/* Данные сотрудника */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-[11.5px]">
          <div>
            <span className="text-slate-500">Сотрудник (ФИО):</span>{' '}
            <strong className="text-slate-900">{user.name}</strong>
          </div>
          <div>
            <span className="text-slate-500">Должность:</span>{' '}
            <strong>{rolesLabel || 'Сотрудник'}</strong>
          </div>
          <div>
            <span className="text-slate-500">Телефон:</span> <span>{user.phone || '—'}</span>
          </div>
          {user.asset && (
            <div>
              <span className="text-slate-500">Закреплённое ТС:</span>{' '}
              <strong>
                {user.asset.short_name} ({user.asset.reg_number})
              </strong>
            </div>
          )}
          {user.is_officially_employed && (
            <div className="col-span-2 pt-1 border-t border-slate-200 text-emerald-800 text-[10.5px]">
              💼 Трудоустройство по ТК РФ | Оклад:{' '}
              {parseFloat(user.official_salary_amount || '0').toLocaleString('ru-RU')} ₽ (день
              выплаты: {user.official_salary_day || 10})
              {user.has_court_orders && ` | Удержания по исп. листам: ${user.court_order_pct}%`}
            </div>
          )}
        </div>

        {/* 1. НАЧИСЛЕНО */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="font-black text-slate-800 uppercase text-[11px]">
              1. Начислено (Оплата за рейсы / заказ-наряды)
            </span>
            <span className="font-mono font-black text-slate-900">
              +{totalAccrued.toLocaleString('ru-RU')} ₽
            </span>
          </div>

          <table className="w-full text-left text-[11px] border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px]">
              <tr>
                <th className="p-2">Дата</th>
                <th className="p-2">Основание / Описание начисления</th>
                <th className="p-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accruals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-3 text-center text-slate-400 italic">
                    Нет начислений за текущий период
                  </td>
                </tr>
              ) : (
                accruals.map((item: PayrollHistoryItem, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-slate-500 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="p-2 font-medium text-slate-800">
                      {item.description || 'Начисление за смену / заказ'}
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      +{parseFloat(item.amount || '0').toLocaleString('ru-RU')} ₽
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 2. УДЕРЖАНО И ВЫПЛАЧЕНО */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Удержания */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
              <span className="font-black text-amber-950 uppercase text-[10.5px]">
                2. Удержано (Авансы / Долги)
              </span>
              <span className="font-mono font-black text-amber-900">
                -{advanceOffset.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg p-2 space-y-1 text-[10.5px] bg-white min-h-[60px]">
              <div className="flex justify-between text-slate-600">
                <span>Зачтено авансов в ЗП:</span>
                <span className="font-mono font-bold text-amber-900">
                  {advanceOffset.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Остаток долга по авансу:</span>
                <span className="font-mono font-bold text-slate-800">
                  {advanceBalance.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              {deductions.length > 0 && (
                <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                  {deductions.slice(0, 3).map((d: PayrollHistoryItem, i: number) => (
                    <div key={d.id || i} className="flex justify-between">
                      <span className="truncate pr-1">• {d.description || 'Удержание'}:</span>
                      <span className="font-mono">
                        {parseFloat(d.amount || '0').toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Выплачено */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
              <span className="font-black text-emerald-950 uppercase text-[10.5px]">
                3. Выплачено за месяц
              </span>
              <span className="font-mono font-black text-emerald-900">
                {totalPaid.toLocaleString('ru-RU')} ₽
              </span>
            </div>

            <div className="border border-slate-200 rounded-lg p-2 space-y-1 text-[10.5px] bg-white min-h-[60px]">
              {payouts.length === 0 ? (
                <div className="text-slate-400 italic text-center py-2">
                  Выплат в текущем месяце не зафиксировано
                </div>
              ) : (
                payouts.map((p: PayrollHistoryItem, idx: number) => (
                  <div key={p.id || idx} className="flex justify-between text-slate-700">
                    <span className="truncate pr-2">
                      {new Date(p.created_at).toLocaleDateString('ru-RU')} —{' '}
                      {p.description || 'Выплата'}
                    </span>
                    <span className="font-mono font-bold text-emerald-800 shrink-0">
                      {parseFloat(p.amount || '0').toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. ИТОГОВЫЙ РАСЧЕТ И ОСТАТОК К ВЫПЛАТЕ */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-300">
            <span>Начислено за период:</span>
            <span className="font-mono font-bold">+{totalAccrued.toLocaleString('ru-RU')} ₽</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-300">
            <span>Удержано / зачтено авансов:</span>
            <span className="font-mono font-bold">-{advanceOffset.toLocaleString('ru-RU')} ₽</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-300">
            <span>Фактически выплачено ранее:</span>
            <span className="font-mono font-bold">-{totalPaid.toLocaleString('ru-RU')} ₽</span>
          </div>

          <div className="pt-2 border-t border-slate-700 flex justify-between items-center">
            <span className="text-sm font-black uppercase tracking-wide text-amber-400">
              ИТОГО К ВЫПЛАТЕ НА РУКИ:
            </span>
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              {totalPayout.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Подписи сторон */}
        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-[11px]">
          <div className="space-y-6">
            <div>
              <strong>Руководитель:</strong>
              <div className="text-slate-600 text-[10px]">ИП Нигамедьянов А.С.</div>
            </div>
            <div className="border-b border-slate-900 w-48 text-center text-[10px] text-slate-400">
              / Нигамедьянов А.С. /
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <strong>С расчётом ознакомлен(а):</strong>
              <div className="text-slate-600 text-[10px]">{user.name}</div>
            </div>
            <div className="border-b border-slate-900 w-48 text-center text-[10px] text-slate-400">
              / Подпись сотрудника /
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
