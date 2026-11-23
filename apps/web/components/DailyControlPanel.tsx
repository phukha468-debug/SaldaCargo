'use client';

import { useMemo, useState } from 'react';
import { AuditCashModal } from '@/features/daily-control/AuditCashModal';
import {
  buildDailyExpenses,
  buildDailyIncomes,
  computeWalletSummary,
} from '@/features/daily-control/buildDailyItems';
import { DailyControlHeader } from '@/features/daily-control/DailyControlHeader';
import { DailyExpensesColumn } from '@/features/daily-control/DailyExpensesColumn';
import { DailyIncomesColumn } from '@/features/daily-control/DailyIncomesColumn';
import { EditTxModal } from '@/features/daily-control/EditTxModal';
import { LinkBankOpModal } from '@/features/daily-control/LinkBankOpModal';
import { ManualTxModal } from '@/features/daily-control/ManualTxModal';
import type {
  EditingTxState,
  PeriodMode,
  TBankOp,
  WalletFilter,
} from '@/features/daily-control/types';
import { useDailyControlData } from '@/features/daily-control/useDailyControlData';

export function DailyControlPanel() {
  const [todayStr] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [yesterdayStr] = useState<string>(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [period, setPeriod] = useState<PeriodMode>('day');
  const [activeWallet, setActiveWallet] = useState<WalletFilter>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [editingTx, setEditingTx] = useState<EditingTxState | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [manualModalType, setManualModalType] = useState<'expense' | 'income' | null>(null);
  const [linkingState, setLinkingState] = useState<{
    op: TBankOp;
    suggestedOrderId?: string;
  } | null>(null);

  const {
    data,
    isFetching,
    refetch,
    calendarItems,
    warehouseParts,
    users,
    categorizeMutation,
    auditMutation,
    createManualMutation,
    linkBankOpMutation,
  } = useDailyControlData({
    selectedDate,
    period,
    todayStr,
    onCategorizeStart: () => setEditingTx(null),
    onAuditSuccess: () => setIsAuditModalOpen(false),
    onManualSuccess: () => setManualModalType(null),
    onLinkSuccess: () => setLinkingState(null),
  });

  const shiftDay = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const shiftPeriod = (delta: number) => {
    if (period === 'day') {
      shiftDay(delta);
    } else if (period === 'week') {
      shiftDay(delta * 7);
    } else {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(1);
      d.setMonth(d.getMonth() + delta);
      setSelectedDate(d.toISOString().slice(0, 10));
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const incomeItems = useMemo(
    () => buildDailyIncomes({ data, activeWallet, period, selectedDate }),
    [data, activeWallet, period, selectedDate],
  );

  const expenseItems = useMemo(
    () => buildDailyExpenses({ data, calendarItems, activeWallet, period, selectedDate }),
    [data, calendarItems, activeWallet, period, selectedDate],
  );

  const totalDayExpenses = useMemo(
    () => expenseItems.reduce((s, i) => s + i.amount, 0),
    [expenseItems],
  );
  const totalDayIncomes = useMemo(
    () => incomeItems.reduce((s, i) => s + i.amount, 0),
    [incomeItems],
  );
  const { morningTotal, eveningTotal, deltaTotal } = useMemo(
    () => computeWalletSummary(data, activeWallet),
    [data, activeWallet],
  );

  return (
    <div className="space-y-3 font-sans pb-10">
      <DailyControlHeader
        data={data}
        selectedDate={selectedDate}
        todayStr={todayStr}
        period={period}
        activeWallet={activeWallet}
        isFetching={isFetching}
        morningTotal={morningTotal}
        eveningTotal={eveningTotal}
        deltaTotal={deltaTotal}
        totalDayExpenses={totalDayExpenses}
        totalDayIncomes={totalDayIncomes}
        expensesCount={expenseItems.length}
        incomesCount={incomeItems.length}
        onChangePeriod={setPeriod}
        onChangeDate={setSelectedDate}
        onShiftPeriod={shiftPeriod}
        onChangeWallet={setActiveWallet}
        onOpenManualModal={setManualModalType}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onRefetch={() => refetch()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <DailyExpensesColumn
          period={period}
          selectedDate={selectedDate}
          expenseItems={expenseItems}
          totalDayExpenses={totalDayExpenses}
          expandedGroups={expandedGroups}
          onToggleGroup={toggleGroup}
          onOpenManualExpense={() => setManualModalType('expense')}
          onEditExpense={setEditingTx}
        />

        <DailyIncomesColumn
          data={data}
          period={period}
          selectedDate={selectedDate}
          incomeItems={incomeItems}
          totalDayIncomes={totalDayIncomes}
          expandedGroups={expandedGroups}
          linkPending={linkBankOpMutation.isPending}
          onToggleGroup={toggleGroup}
          onOpenManualIncome={() => setManualModalType('income')}
          onEditIncome={setEditingTx}
          onLinkBankOp={(payload) => linkBankOpMutation.mutate(payload)}
          onOpenLinkModal={(op, suggestedOrderId) => setLinkingState({ op, suggestedOrderId })}
        />
      </div>

      {editingTx && (
        <EditTxModal
          key={editingTx.id}
          initialTx={editingTx}
          selectedDate={selectedDate}
          categories={data?.categories ?? []}
          calendarItems={calendarItems}
          warehouseParts={warehouseParts}
          users={users}
          onSave={(payload) => categorizeMutation.mutate(payload)}
          onClose={() => setEditingTx(null)}
        />
      )}

      {isAuditModalOpen && (
        <AuditCashModal
          selectedDate={selectedDate}
          data={data}
          isPending={auditMutation.isPending}
          onSubmit={(payload) => auditMutation.mutate(payload)}
          onClose={() => setIsAuditModalOpen(false)}
        />
      )}

      {linkingState && (
        <LinkBankOpModal
          key={linkingState.op.operationId}
          bankOp={linkingState.op}
          initialSuggestedOrderId={linkingState.suggestedOrderId}
          selectedDate={selectedDate}
          todayStr={todayStr}
          yesterdayStr={yesterdayStr}
          period={period}
          isPending={linkBankOpMutation.isPending}
          onSubmit={(payload) => linkBankOpMutation.mutate(payload)}
          onClose={() => setLinkingState(null)}
        />
      )}

      {manualModalType && (
        <ManualTxModal
          key={manualModalType}
          initialType={manualModalType}
          categories={data?.categories ?? []}
          calendarItems={calendarItems}
          tripOrders={data?.trip_orders ?? []}
          isPending={createManualMutation.isPending}
          errorMessage={
            createManualMutation.isError
              ? (createManualMutation.error as Error)?.message || 'Ошибка сохранения'
              : null
          }
          onSubmit={(payload) => createManualMutation.mutate(payload)}
          onClose={() => setManualModalType(null)}
        />
      )}
    </div>
  );
}
