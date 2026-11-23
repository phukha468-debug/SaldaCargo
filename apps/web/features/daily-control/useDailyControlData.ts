'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BANK_ID,
  CASH_ID,
  FUEL_CARD_ID,
  type DailyBalanceData,
  type GaragePartOption,
  type PaymentCalendarItem,
  type PeriodMode,
  type WarehousePartItem,
} from './types';

export interface CategorizePayload {
  id: string;
  description: string;
  category_id?: string | null;
  categoryName?: string;
  amount?: number;
  direction?: string;
  to_wallet_id?: string | null;
  from_wallet_id?: string | null;
  transaction_date?: string;
  obligation_id?: string | null;
  related_user_id?: string | null;
  warehouse_enabled?: boolean;
  warehouse_parts?: Array<{
    brand: string;
    client_car_model?: string | null;
    name: string;
    article?: string | null;
    quantity: number;
    unit_price: number;
  }>;
  warehouse_part?: {
    enabled: boolean;
    brand?: string;
    client_car_model?: string | null;
    name?: string;
    article?: string | null;
    quantity?: number;
    unit_price?: number;
    part_id?: string | null;
  } | null;
}

export interface CreateManualPayload {
  manualType: 'expense' | 'income';
  manualAmount: string;
  manualWallet: 'safe' | 'bank' | 'fuel';
  manualCategoryId: string;
  manualDescription: string;
  manualObligationId: string;
  manualTripOrderId: string;
}

export interface LinkBankOpPayload {
  operationId: string;
  tripOrderId?: string;
  tripOrderIds?: string[];
  amount?: number;
  action?: 'link' | 'unlink';
  operationDate?: string;
  date?: string;
  linkType?: 'trip' | 'service_order' | 'dispatcher';
  serviceOrderId?: string;
  dispatcherDetails?: string;
  clientName?: string;
}

export function useDailyControlData({
  selectedDate,
  period,
  todayStr,
  onCategorizeStart,
  onAuditSuccess,
  onManualSuccess,
  onLinkSuccess,
}: {
  selectedDate: string;
  period: PeriodMode;
  todayStr: string;
  onCategorizeStart: () => void;
  onAuditSuccess: () => void;
  onManualSuccess: () => void;
  onLinkSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const selectedPeriod = selectedDate.slice(0, 7);

  const { data: calendarData } = useQuery<{ items?: PaymentCalendarItem[] }>({
    queryKey: ['payment-calendar-items', selectedPeriod],
    queryFn: () => fetch(`/api/payment-calendar?period=${selectedPeriod}`).then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const { data: warehousePartsData } = useQuery<{ parts: GaragePartOption[] }>({
    queryKey: ['garage-parts-all'],
    queryFn: () => fetch('/api/garage/parts?brand=all').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const { data, isFetching, refetch } = useQuery<DailyBalanceData>({
    queryKey: ['daily-balance', selectedDate, period],
    queryFn: () =>
      fetch(`/api/finance/daily-balance?date=${selectedDate}&period=${period}`).then((r) =>
        r.json(),
      ),
    staleTime: 30 * 1000,
    refetchInterval: selectedDate === todayStr && period === 'day' ? 60 * 1000 : false,
  });

  const { data: usersData } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users-list'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const categorizeMutation = useMutation({
    mutationFn: async (payload: CategorizePayload) => {
      const res = await fetch('/api/finance/categorize-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payload.id,
          description: payload.description,
          category_id: payload.category_id,
          amount: payload.amount,
          direction: payload.direction,
          to_wallet_id: payload.to_wallet_id,
          from_wallet_id: payload.from_wallet_id,
          transaction_date: payload.transaction_date,
          obligation_id: payload.obligation_id,
          related_user_id: payload.related_user_id,
          warehouse_enabled: payload.warehouse_enabled,
          warehouse_parts: payload.warehouse_parts,
          warehouse_part: payload.warehouse_part,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при сохранении');
      }
      return res.json();
    },
    onMutate: async (newOp) => {
      onCategorizeStart();
      await queryClient.cancelQueries({ queryKey: ['daily-balance', selectedDate, period] });
      const previousData = queryClient.getQueryData<DailyBalanceData>([
        'daily-balance',
        selectedDate,
        period,
      ]);

      if (previousData) {
        const cleanId = String(newOp.id)
          .replace(/^tbank-deb-/, '')
          .replace(/^tbank-/, '');

        const updatedTxList = [...(previousData.transactions || [])];
        const txIdx = updatedTxList.findIndex(
          (t) => t.id === cleanId || t.idempotency_key === cleanId,
        );
        const updatedBankOps = (previousData.bank_operations || []).filter(
          (op) => op.operationId !== cleanId,
        );

        const categoryObj = newOp.category_id
          ? previousData.categories?.find((c) => c.id === newOp.category_id) || {
              id: newOp.category_id,
              name: newOp.categoryName || 'Обновлено',
              code: 'UPDATED',
            }
          : null;

        const warehousePartsList: WarehousePartItem[] =
          newOp.warehouse_parts && newOp.warehouse_parts.length > 0
            ? newOp.warehouse_parts.map((p) => ({
                name: p.name,
                brand: p.brand,
                clientCarModel: p.client_car_model,
                quantity: p.quantity,
                unit_price: p.unit_price,
                article: p.article || null,
              }))
            : newOp.warehouse_part?.enabled
              ? [
                  {
                    name: newOp.warehouse_part.name || newOp.description,
                    brand: newOp.warehouse_part.brand || 'canter',
                    clientCarModel: newOp.warehouse_part.client_car_model,
                    quantity: newOp.warehouse_part.quantity || 1,
                    unit_price: newOp.warehouse_part.unit_price || newOp.amount,
                    article: newOp.warehouse_part.article || null,
                  },
                ]
              : [];

        const warehousePartObj = warehousePartsList.length > 0 ? warehousePartsList[0]! : null;

        if (txIdx >= 0 && updatedTxList[txIdx]) {
          const target = updatedTxList[txIdx]!;
          updatedTxList[txIdx] = {
            ...target,
            description: newOp.description,
            category_id: newOp.category_id,
            category: categoryObj,
            warehouse_part:
              newOp.warehouse_enabled === false
                ? null
                : warehousePartObj !== null
                  ? warehousePartObj
                  : target.warehouse_part,
            warehouse_parts:
              newOp.warehouse_enabled === false
                ? []
                : warehousePartsList.length > 0
                  ? warehousePartsList
                  : target.warehouse_parts,
            to_wallet_id:
              newOp.to_wallet_id !== undefined ? newOp.to_wallet_id : target.to_wallet_id,
            from_wallet_id:
              newOp.from_wallet_id !== undefined ? newOp.from_wallet_id : target.from_wallet_id,
            related_user_id:
              newOp.related_user_id !== undefined ? newOp.related_user_id : target.related_user_id,
          };
        } else {
          updatedTxList.unshift({
            id: cleanId,
            amount: String(newOp.amount || 0),
            direction: newOp.direction || 'expense',
            description: newOp.description,
            created_at: newOp.transaction_date || new Date().toISOString(),
            transaction_date: newOp.transaction_date || new Date().toISOString(),
            from_wallet_id: newOp.from_wallet_id || BANK_ID,
            to_wallet_id: newOp.to_wallet_id || null,
            category_id: newOp.category_id,
            idempotency_key: cleanId,
            category: categoryObj,
            warehouse_part: warehousePartObj,
            warehouse_parts: warehousePartsList,
            counterparty: null,
            related_user: null,
          });
        }

        queryClient.setQueryData<DailyBalanceData>(['daily-balance', selectedDate, period], {
          ...previousData,
          transactions: updatedTxList,
          bank_operations: updatedBankOps,
        });
      }

      return { previousData };
    },
    onSuccess: (res) => {
      if (res?.transaction) {
        queryClient.setQueryData<DailyBalanceData>(
          ['daily-balance', selectedDate, period],
          (old) => {
            if (!old) return old;
            const txs = [...(old.transactions || [])];
            const idx = txs.findIndex(
              (t) =>
                t.id === res.transaction.id ||
                t.idempotency_key === res.transaction.idempotency_key,
            );
            if (idx >= 0) {
              const resParts: WarehousePartItem[] = Array.isArray(res.warehouse_movements)
                ? res.warehouse_movements.map(
                    (m: {
                      id: string;
                      part_id: string;
                      quantity?: number;
                      unit_price?: number;
                      part?: { name?: string; category?: string; article?: string | null };
                    }) => ({
                      movement_id: m.id,
                      part_id: m.part_id,
                      name: m.part?.name || 'Запчасть',
                      brand: m.part?.category || 'canter',
                      article: m.part?.article || null,
                      quantity: Number(m.quantity) || 1,
                      unit_price: Number(m.unit_price) || 0,
                    }),
                  )
                : res.warehouse_movement
                  ? [
                      {
                        movement_id: res.warehouse_movement.id,
                        part_id: res.warehouse_movement.part_id,
                        name: res.warehouse_movement.part?.name || 'Запчасть',
                        brand: res.warehouse_movement.part?.category || 'canter',
                        article: res.warehouse_movement.part?.article || null,
                        quantity: Number(res.warehouse_movement.quantity) || 1,
                        unit_price: Number(res.warehouse_movement.unit_price) || 0,
                      },
                    ]
                  : [];

              txs[idx] = {
                ...txs[idx],
                ...res.transaction,
                warehouse_parts: resParts.length > 0 ? resParts : txs[idx]?.warehouse_parts,
                warehouse_part:
                  resParts.length > 0
                    ? resParts[0]
                    : res.warehouse_movement
                      ? {
                          name: res.warehouse_movement.part?.name || txs[idx]?.warehouse_part?.name,
                          brand:
                            res.warehouse_movement.part?.category ||
                            txs[idx]?.warehouse_part?.brand,
                          quantity: res.warehouse_movement.quantity || 1,
                          unit_price: res.warehouse_movement.unit_price,
                        }
                      : txs[idx]?.warehouse_part,
              };
            }
            return { ...old, transactions: txs };
          },
        );
      }
    },
    onError: (err, _newOp, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['daily-balance', selectedDate, period], context.previousData);
      }
      alert('Ошибка при сохранении: ' + (err.message || 'Сбой сети'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['garage-parts'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['garage-parts-all'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['garage-inventory'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['finance-month'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar-items'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['wallets'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'], refetchType: 'none' });
    },
  });

  const auditMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      safe_cash_actual: number;
      safe_cash_expected: number;
      bank_balance: number;
      fuel_card_balance: number;
      audited_by: string;
      notes: string;
    }) => {
      const res = await fetch('/api/finance/daily-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка подтверждения');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      onAuditSuccess();
    },
  });

  const createManualMutation = useMutation({
    mutationFn: async (input: CreateManualPayload) => {
      const amt = parseFloat(input.manualAmount);
      if (isNaN(amt) || amt <= 0) throw new Error('Укажите корректную сумму');
      if (!input.manualDescription.trim()) throw new Error('Укажите описание операции');

      let fromW: string | null = null;
      let toW: string | null = null;
      if (input.manualType === 'expense') {
        fromW =
          input.manualWallet === 'safe'
            ? CASH_ID
            : input.manualWallet === 'fuel'
              ? FUEL_CARD_ID
              : BANK_ID;
      } else {
        toW = input.manualWallet === 'safe' ? CASH_ID : BANK_ID;
      }

      const res = await fetch('/api/finance/categorize-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          direction: input.manualType,
          amount: amt,
          description: input.manualDescription.trim(),
          category_id: input.manualCategoryId || null,
          from_wallet_id: fromW,
          to_wallet_id: toW,
          transaction_date: `${selectedDate}T12:00:00.000Z`,
          obligation_id: input.manualObligationId || null,
          trip_order_id: input.manualTripOrderId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при сохранении операции');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['finance-month'] });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar-items'] });
      queryClient.invalidateQueries({ queryKey: ['payment-calendar'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      onManualSuccess();
    },
  });

  const linkBankOpMutation = useMutation({
    mutationFn: async (payload: LinkBankOpPayload) => {
      const res = await fetch('/api/finance/link-bank-op', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          linkType: payload.linkType ?? 'trip',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка привязки операции');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-balance', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['linkable-orders'] });
      onLinkSuccess();
    },
    onError: (err: Error) => {
      console.error('linkBankOp error:', err);
      alert('Ошибка при связывании операции: ' + (err?.message || 'Не удалось связать с рейсом'));
    },
  });

  return {
    data,
    isFetching,
    refetch,
    calendarItems: calendarData?.items ?? [],
    warehouseParts: warehousePartsData?.parts ?? [],
    users: usersData ?? [],
    categorizeMutation,
    auditMutation,
    createManualMutation,
    linkBankOpMutation,
  };
}
