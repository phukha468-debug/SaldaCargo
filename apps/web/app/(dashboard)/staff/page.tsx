'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Money, cn } from '@saldacargo/ui';
import { PayslipModal } from './payslip-modal';
import { AccountableSection } from './accountable-section';
import { ShiftCalendarModal } from './shift-calendar-modal';
import { MONTH_NAMES } from '@/features/staff/constants';
import { GROUP_CONFIG } from '@/features/staff/groupConfig';
import type {
  Asset,
  GroupKey,
  PayrollResponse,
  PayrollUser,
  StaffUser,
} from '@/features/staff/types';
import { StaffModal } from '@/features/staff/StaffModal';
import { SettleModal } from '@/features/staff/settle/SettleModal';
import { PayrollHistoryModal } from '@/features/staff/history/PayrollHistoryModal';
import { PayrollSection } from '@/features/staff/PayrollSection';
import { ManualPayModal } from '@/features/staff/ManualPayModal';
import { AdvanceModal } from '@/features/staff/AdvanceModal';
import { AddStaffDebtModal } from '@/features/staff/AddStaffDebtModal';

export default function StaffPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeGroup, setActiveGroup] = useState<GroupKey>('drivers');
  const [settleUser, setSettleUser] = useState<PayrollUser | null>(null);
  const [advanceUser, setAdvanceUser] = useState<PayrollUser | null>(null);
  const [manualPayUser, setManualPayUser] = useState<PayrollUser | null>(null);
  const [editUser, setEditUser] = useState<StaffUser | 'new' | null>(null);
  const [historyUser, setHistoryUser] = useState<PayrollUser | null>(null);
  const [payslipUser, setPayslipUser] = useState<PayrollUser | null>(null);
  const [shiftModalUser, setShiftModalUser] = useState<PayrollUser | null>(null);
  const [debtModalUser, setDebtModalUser] = useState<{
    user?: PayrollUser;
    action?: 'add' | 'repay' | 'adjust';
  } | null>(null);
  const [driverFilter, setDriverFilter] = useState<'all' | 'official' | 'court'>('all');
  const [isAccruingOfficial, setIsAccruingOfficial] = useState(false);

  const handleRunOfficialPayroll = async () => {
    setIsAccruingOfficial(true);
    try {
      const res = await fetch('/api/cron/official-payroll?force_accrual=true');
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ['staff-payroll'] });
      if (data.accruals_created > 0) {
        alert(`Успешно начислено: ${data.accruals_created} платежей (ТК РФ / ФССП)`);
      } else {
        alert(`Все обязательные начисления за ${data.month || 'текущий месяц'} уже актуальны.`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Неизвестная ошибка';
      alert(`Ошибка начисления: ${msg}`);
    } finally {
      setIsAccruingOfficial(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const { data: payroll, isLoading } = useQuery<PayrollResponse>({
    queryKey: ['staff-payroll', year, month],
    queryFn: () => fetch(`/api/staff/payroll?year=${year}&month=${month}`).then((r) => r.json()),
    staleTime: 120000,
  });

  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ['assets-list'],
    queryFn: () =>
      fetch('/api/fleet?period=current_month')
        .then((r) => r.json())
        .then((r) => r.assets ?? []),
    staleTime: 300000,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-payroll'] }),
  });

  const handleDeactivate = (u: PayrollUser) => {
    patchMutation.mutate({ id: u.id, body: { is_active: false } });
  };

  const handleEdit = (u: PayrollUser) => {
    setEditUser({
      id: u.id,
      name: u.name,
      phone: u.phone,
      max_user_id: u.max_user_id,
      pin_code: u.pin_code ?? null,
      roles: u.roles,
      current_asset_id: u.current_asset_id ?? null,
      auto_settle: u.auto_settle,
      is_active: true,
      notes: u.notes,
      is_officially_employed: u.is_officially_employed,
      official_salary_amount: u.official_salary_amount,
      official_salary_day: u.official_salary_day,
      has_court_orders: u.has_court_orders,
      court_order_pct: u.court_order_pct,
      court_order_notes: u.court_order_notes,
    });
  };

  const allStaffUsers = payroll
    ? [
        ...payroll.drivers,
        ...payroll.loaders,
        ...payroll.mechanics,
        ...payroll.office,
        ...(payroll.cleaners || []),
      ]
        .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    : [];

  const totalDebt = payroll ? parseFloat(payroll.total_debt_alltime) : 0;
  const totalFundMonth = payroll ? parseFloat(payroll.total_earned_month) : 0;
  const totalPaidMonth = payroll ? parseFloat(payroll.total_paid_month) : 0;
  const totalStaff = allStaffUsers.length;

  const cfg = GROUP_CONFIG[activeGroup];
  const rawUsers = payroll ? cfg.getUsers(payroll) : [];
  const activeUsers =
    activeGroup === 'drivers'
      ? rawUsers.filter((u) => {
          if (driverFilter === 'official') return u.is_officially_employed;
          if (driverFilter === 'court') return u.is_officially_employed && u.has_court_orders;
          return true;
        })
      : rawUsers;

  const officialDriversCount =
    payroll?.drivers?.filter((d) => d.is_officially_employed).length ?? 0;
  const courtDriversCount =
    payroll?.drivers?.filter((d) => d.is_officially_employed && d.has_court_orders).length ?? 0;

  return (
    <div className="space-y-3 max-w-5xl mx-auto animate-in fade-in duration-500">
      {/* Переключатель месяца */}
      <div className="bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-stretch h-11">
          <button
            onClick={() => shiftMonth(-1)}
            className="flex items-center justify-center w-14 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 transition-colors shrink-0"
          >
            <span className="text-xl font-black text-white">←</span>
          </button>
          <div className="flex-1 flex items-center justify-center gap-3 px-4">
            <span className="text-base font-black text-white tracking-wide">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            {!isCurrentMonth && (
              <button
                onClick={() => {
                  setYear(now.getFullYear());
                  setMonth(now.getMonth() + 1);
                }}
                className="text-xs font-bold text-sky-300 bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 rounded-full hover:bg-sky-500/30 transition-colors"
              >
                → сейчас
              </button>
            )}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="flex items-center justify-center w-14 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <span className="text-xl font-black text-white">→</span>
          </button>
        </div>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Сотрудников',
            value: (
              <span className="flex items-baseline gap-2">
                <span>{totalStaff}</span>
                {officialDriversCount > 0 && (
                  <span className="text-xs font-bold text-emerald-600">
                    💼 {officialDriversCount} ТК РФ
                  </span>
                )}
              </span>
            ),
            color: 'text-slate-900',
          },
          {
            label: 'Фонд ЗП (мес)',
            value: isLoading ? '—' : <Money amount={totalFundMonth.toFixed(2)} />,
            color: 'text-slate-800',
          },
          {
            label: 'Выплачено (мес)',
            value: isLoading ? '—' : <Money amount={totalPaidMonth.toFixed(2)} />,
            color: 'text-emerald-600',
          },
          {
            label: 'Долг (всего)',
            value: isLoading ? '—' : <Money amount={totalDebt.toFixed(2)} />,
            color: totalDebt > 0 ? 'text-amber-600' : 'text-slate-400',
          },
          {
            label: 'Подотчёт (на руках)',
            value: isLoading ? (
              '—'
            ) : (
              <button
                type="button"
                onClick={() => setActiveGroup('accountable')}
                className="hover:underline cursor-pointer flex items-baseline gap-1 text-left"
                title="Перейти к подотчёту водителей"
              >
                <Money amount={payroll?.total_accountable_hold ?? '0.00'} />
              </button>
            ),
            color:
              parseFloat(payroll?.total_accountable_hold ?? '0') > 0
                ? 'text-amber-600'
                : 'text-slate-400',
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
              {label}
            </p>
            <p className={cn('text-xl font-black', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Табы + кнопки действий */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(GROUP_CONFIG) as GroupKey[]).map((key) => {
            const g = GROUP_CONFIG[key];
            const isActive = activeGroup === key;
            const count = payroll ? g.getCount(payroll) : 0;
            return (
              <button
                key={key}
                onClick={() => setActiveGroup(key)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all',
                  isActive ? g.tabActive : g.tabInactive,
                )}
              >
                {g.label}
                <span
                  className={cn(
                    'text-[10px] font-black px-1.5 py-0.5 rounded-full',
                    isActive ? g.countActive : g.countInactive,
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activeGroup === 'cleaners' && activeUsers.length > 0 && (
            <button
              onClick={() => {
                if (activeUsers[0]) setShiftModalUser(activeUsers[0]);
              }}
              className="bg-teal-700 text-white text-sm font-bold px-3.5 py-2 rounded-xl hover:bg-teal-800 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Открыть табель смен для первой уборщицы"
            >
              <span>📅</span>
              <span>Табель смен</span>
            </button>
          )}
          {activeUsers.length > 0 && (
            <button
              onClick={() => {
                if (activeUsers[0]) setPayslipUser(activeUsers[0]);
              }}
              className="bg-indigo-600 text-white text-sm font-bold px-3.5 py-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Сформировать расчётный лист сотрудника"
            >
              <span>📄</span>
              <span>Расчётный лист</span>
            </button>
          )}
          <button
            onClick={() => setDebtModalUser({ action: 'add' })}
            className="bg-violet-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
          >
            + Записать долг сотрудника
          </button>
          <button
            onClick={() => setEditUser('new')}
            className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors"
          >
            + Сотрудник
          </button>
        </div>
      </div>

      {/* Баннер ТК РФ */}
      {activeGroup === 'drivers' && (
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-2.5 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-lg shrink-0">
              ТК РФ
            </span>
            <span className="text-emerald-950 font-medium truncate">
              Налог (5 000 ₽) и удержания ФССП/алименты начисляются 1-го числа в долг и вычитаются
              из рейсов.
            </span>
          </div>
          <div className="flex items-center gap-1 bg-emerald-100/70 p-1 rounded-xl shrink-0 self-end sm:self-auto font-bold text-xs">
            <button
              onClick={() => setDriverFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all',
                driverFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-emerald-800 hover:text-emerald-950',
              )}
            >
              Все ({rawUsers.length})
            </button>
            <button
              onClick={() => setDriverFilter('official')}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all flex items-center gap-1',
                driverFilter === 'official'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-emerald-800 hover:text-emerald-950',
              )}
            >
              <span>💼 ТК РФ</span>
              <span className="text-[10px] font-black bg-emerald-200 px-1.5 py-0.2 rounded-full">
                {officialDriversCount}
              </span>
            </button>
            {courtDriversCount > 0 && (
              <button
                onClick={() => setDriverFilter('court')}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all flex items-center gap-1',
                  driverFilter === 'court'
                    ? 'bg-white text-rose-900 shadow-sm'
                    : 'text-rose-800 hover:text-rose-950',
                )}
              >
                <span>⚖️ ФССП</span>
                <span className="text-[10px] font-black bg-rose-200 px-1.5 py-0.2 rounded-full">
                  {courtDriversCount}
                </span>
              </button>
            )}
            <button
              onClick={handleRunOfficialPayroll}
              disabled={isAccruingOfficial}
              title="Проверить и начислить долги по ТК РФ и ФССП за текущий месяц"
              className="px-2 py-1 rounded-lg transition-all flex items-center gap-1 bg-white text-emerald-800 hover:text-emerald-950 border border-emerald-300 shadow-sm disabled:opacity-50 font-semibold"
            >
              <span>{isAccruingOfficial ? '⏳' : '⚡'} Начислить</span>
            </button>
          </div>
        </div>
      )}

      {/* Таблица или подотчёт */}
      {isLoading ? (
        <div className="h-48 bg-slate-100 rounded-2xl animate-pulse" />
      ) : activeGroup === 'accountable' ? (
        <AccountableSection />
      ) : (
        <PayrollSection
          users={activeUsers}
          headerBg={cfg.headerBg}
          headerTextColor={cfg.headerTextColor}
          onSettle={setSettleUser}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onAdvance={activeGroup === 'debts' ? setAdvanceUser : undefined}
          onManualPay={setManualPayUser}
          onHistory={setHistoryUser}
          onAdjustDebt={
            activeGroup === 'debts'
              ? (u) => setDebtModalUser({ user: u, action: 'adjust' })
              : undefined
          }
          onPayslip={setPayslipUser}
          onOpenShifts={setShiftModalUser}
        />
      )}

      {historyUser && (
        <PayrollHistoryModal
          user={historyUser}
          onClose={() => setHistoryUser(null)}
          onSettle={() => {
            const u = historyUser;
            setHistoryUser(null);
            setSettleUser(u);
          }}
          onChanged={() => {
            setHistoryUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
          onOpenPayslip={(u) => {
            setHistoryUser(null);
            setPayslipUser(u);
          }}
        />
      )}

      {shiftModalUser && (
        <ShiftCalendarModal
          user={shiftModalUser}
          initialYear={year}
          initialMonth={month}
          onClose={() => setShiftModalUser(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
          onOpenPayslip={() => {
            const u = shiftModalUser;
            setShiftModalUser(null);
            setPayslipUser(u);
          }}
        />
      )}

      {payslipUser && (
        <PayslipModal
          user={payslipUser}
          monthName={MONTH_NAMES[month - 1] ?? 'Текущий месяц'}
          monthNumber={month}
          year={year}
          onClose={() => setPayslipUser(null)}
        />
      )}

      {settleUser && (
        <SettleModal
          user={settleUser}
          onClose={() => setSettleUser(null)}
          onSuccess={() => {
            setSettleUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}

      {manualPayUser && (
        <ManualPayModal
          user={manualPayUser}
          onClose={() => setManualPayUser(null)}
          onSuccess={() => {
            setManualPayUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {advanceUser && (
        <AdvanceModal
          user={advanceUser}
          onClose={() => setAdvanceUser(null)}
          onSuccess={() => {
            setAdvanceUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {debtModalUser && (
        <AddStaffDebtModal
          allUsers={allStaffUsers}
          initialUserId={debtModalUser.user?.id}
          initialAction={debtModalUser.action}
          onClose={() => setDebtModalUser(null)}
          onSuccess={() => {
            setDebtModalUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
            qc.invalidateQueries({ queryKey: ['wallets'] });
          }}
        />
      )}

      {editUser !== null && (
        <StaffModal
          editUser={editUser === 'new' ? null : editUser}
          assets={assets}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ['staff-payroll'] });
          }}
        />
      )}
    </div>
  );
}
