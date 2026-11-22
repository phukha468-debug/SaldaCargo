'use client';

import { Money, cn } from '@saldacargo/ui';
import type { PayrollUser } from './types';
import { PayrollRow } from './PayrollRow';

export function PayrollSection({
  users,
  headerBg,
  headerTextColor,
  onSettle,
  onEdit,
  onDeactivate,
  onAdvance,
  onManualPay,
  onHistory,
  onAdjustDebt,
  onPayslip,
  onOpenShifts,
}: {
  users: PayrollUser[];
  headerBg: string;
  headerTextColor: string;
  onSettle: (u: PayrollUser) => void;
  onEdit: (u: PayrollUser) => void;
  onDeactivate: (u: PayrollUser) => void;
  onAdvance?: (u: PayrollUser) => void;
  onManualPay: (u: PayrollUser) => void;
  onHistory: (u: PayrollUser) => void;
  onAdjustDebt?: (u: PayrollUser) => void;
  onPayslip?: (u: PayrollUser) => void;
  onOpenShifts?: (u: PayrollUser) => void;
}) {
  if (users.length === 0)
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-10 text-center">
        <p className="text-sm text-slate-400 font-medium">Нет сотрудников в этой группе</p>
      </div>
    );

  const totalDebt = users.reduce((s, u) => s + parseFloat(u.debt), 0);
  const totalAdvance = users.reduce((s, u) => s + parseFloat(u.advance_balance ?? '0'), 0);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1020px]">
          <div className={cn('flex items-center gap-3 px-4 py-2', headerBg)}>
            <div className="w-60 shrink-0">
              <span
                className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}
              >
                Сотрудник / Роль
              </span>
            </div>
            <div className="w-16 shrink-0 text-center">
              <span
                className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}
              >
                Смен
              </span>
            </div>
            <div className="w-28 shrink-0 text-right">
              <span
                className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}
              >
                Заработал
              </span>
            </div>
            <div className="w-28 shrink-0 text-right">
              <span
                className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}
              >
                Выплачено
              </span>
            </div>
            <div className="w-32 shrink-0 text-right">
              <span
                className={cn('text-[10px] font-bold uppercase tracking-widest', headerTextColor)}
              >
                К выплате
              </span>
            </div>
            <div className="flex-1 text-right">
              {totalDebt > 0 && (
                <span className="text-xs font-black text-white">
                  Долг: <Money amount={totalDebt.toFixed(2)} />
                </span>
              )}
              {totalDebt === 0 && totalAdvance > 0 && (
                <span className="text-xs font-black text-white/80">
                  Авансы: <Money amount={totalAdvance.toFixed(2)} />
                </span>
              )}
            </div>
          </div>

          {users.map((u) => (
            <PayrollRow
              key={u.id}
              user={u}
              onSettle={() => onSettle(u)}
              onEdit={() => onEdit(u)}
              onDeactivate={() => onDeactivate(u)}
              onAdvance={onAdvance ? () => onAdvance(u) : undefined}
              onManualPay={() => onManualPay(u)}
              onHistory={() => onHistory(u)}
              onAdjustDebt={onAdjustDebt ? () => onAdjustDebt(u) : undefined}
              onPayslip={onPayslip ? () => onPayslip(u) : undefined}
              onOpenShifts={onOpenShifts ? () => onOpenShifts(u) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
