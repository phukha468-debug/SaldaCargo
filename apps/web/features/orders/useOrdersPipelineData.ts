'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillingDocsWorkflow,
  OrderCounterpartyOption,
  OrderDriverOption,
  OrderItem,
  OrderPresetOption,
  OrderVehicleOption,
} from './types';

export function useOrdersPipelineData({
  selectedDetailsOrder,
  setSelectedDetailsOrder,
  assignModalOrder,
  setAssignModalOrder,
  setRateModalOrder,
}: {
  selectedDetailsOrder: OrderItem | null;
  setSelectedDetailsOrder: React.Dispatch<React.SetStateAction<OrderItem | null>>;
  assignModalOrder: OrderItem | null;
  setAssignModalOrder: React.Dispatch<React.SetStateAction<OrderItem | null>>;
  setRateModalOrder: React.Dispatch<React.SetStateAction<OrderItem | null>>;
}) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<OrderItem[]>({
    queryKey: ['orders-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/orders');
      const json = await res.json();
      return json.orders || [];
    },
    refetchInterval: 10000,
  });

  const { data: vehicles = [] } = useQuery<OrderVehicleOption[]>({
    queryKey: ['vehicles-list'],
    queryFn: async () => {
      const res = await fetch('/api/fleet');
      const json = await res.json();
      return json.vehicles || json.assets || [];
    },
  });

  const { data: drivers = [] } = useQuery<OrderDriverOption[]>({
    queryKey: ['drivers-list'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      const json = await res.json();
      const list: OrderDriverOption[] = Array.isArray(json) ? json : json.users || [];
      return list.filter((u) => u.roles?.includes('driver'));
    },
  });

  const { data: counterparties = [] } = useQuery<OrderCounterpartyOption[]>({
    queryKey: ['counterparties-all'],
    queryFn: async () => {
      const res = await fetch('/api/counterparties');
      const json = await res.json();
      return Array.isArray(json) ? json : json.counterparties || [];
    },
  });

  const { data: presets = [] } = useQuery<OrderPresetOption[]>({
    queryKey: ['order-presets'],
    queryFn: async () => {
      const res = await fetch('/api/order-presets');
      const json = await res.json();
      return json.presets || [];
    },
  });

  const { data: loadingPoints = [] } = useQuery<unknown[]>({
    queryKey: ['loading-points'],
    queryFn: async () => {
      const res = await fetch('/api/loading-points');
      const json = await res.json();
      return json.loading_points || [];
    },
  });

  const autoProgressMutation = useMutation({
    mutationFn: async ({
      orderId,
      action,
      forceFinish = true,
    }: {
      orderId: string;
      action: 'depart' | 'arrive';
      forceFinish?: boolean;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/auto-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, forceFinish }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены статуса');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.transit) {
        alert(
          `🔄 Зафиксирован промежуточный заезд в Верхнюю Салду (заезд #${data.salda_transit_count})!\nГалочка составного рейса автоматически снята. Рейс продолжается в статусе «В ПУТИ» — второй заезд в Салду автоматически закроет заявку.`,
        );
      } else if (data.status === 'pending_review') {
        alert(
          `🏁 Wialon зафиксировал возврат в Верхнюю Салду!\nПробег: ${data.distanceKm} км (${data.kmPay} ₽) + Суточные: ${data.daysCount} дн (${data.perDiemPay} ₽) = Итого ЗП водителя: ${data.totalDriverPay} ₽.\nСформирована дебиторская задолженность, рейс отправлен на ревью.`,
        );
      } else if (data.status === 'in_progress') {
        alert(
          `🚀 Wialon зафиксировал выезд за радиус Верхней Салды!\nСтатус: В ПУТИ, создан связанный рейс trips, одометр выезда зафиксирован.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder) setSelectedDetailsOrder(null);
    },
    onError: (err: Error) => alert(`Ошибка Wialon: ${err.message}`),
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      orderId,
      vehicleId,
      driverId,
    }: {
      orderId: string;
      vehicleId: string;
      driverId: string;
    }) => {
      const targetOrder = assignModalOrder || orders.find((o) => o.id === orderId);
      const isWaiting =
        !targetOrder?.status ||
        targetOrder.status === 'waiting_vehicle' ||
        targetOrder.status === 'draft';
      const targetStatus = isWaiting ? 'assigned' : targetOrder.status;

      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_vehicle_id: vehicleId,
          assigned_driver_id: driverId,
          status: targetStatus,
        }),
      });
      if (!res.ok) throw new Error('Не удалось назначить ТС');
      return res.json();
    },
    onSuccess: () => {
      setAssignModalOrder(null);
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      if (selectedDetailsOrder) setSelectedDetailsOrder(null);
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Ошибка закрытия заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder) setSelectedDetailsOrder(null);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка удаления заявки');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      setSelectedDetailsOrder(null);
    },
    onError: (err: Error) => alert(`Ошибка удаления: ${err.message}`),
  });

  const billingDocsMutation = useMutation({
    mutationFn: async ({
      orderId,
      docs,
    }: {
      orderId: string;
      docs: Partial<BillingDocsWorkflow>;
    }) => {
      const res = await fetch(`/api/orders/${orderId}/billing-docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docs),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка сохранения документов');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (variables.docs.client_accepted_edo) {
        alert(
          '✅ Документы подписаны контрагентом в ЭДО (поставлены В ОПЛАТУ)!\nСчёт передан в Дебиторку, рейс скрыт из списка активных документов.',
        );
      }
    },
    onError: (err: Error) => alert(`Ошибка: ${err.message}`),
  });

  const manualStageMutation = useMutation({
    mutationFn: async ({ orderId, stage }: { orderId: string; stage: OrderItem['status'] }) => {
      const res = await fetch(`/api/orders/${orderId}/manual-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка смены этапа');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder && selectedDetailsOrder.id === data.order?.id) {
        setSelectedDetailsOrder(data.order);
      }
    },
    onError: (err: Error) => alert(`Ошибка: ${err.message}`),
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({
      orderId,
      priceWithoutVat,
    }: {
      orderId: string;
      priceWithoutVat: number;
    }) => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_without_vat: priceWithoutVat }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка изменения ставки');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      if (selectedDetailsOrder && selectedDetailsOrder.id === data.order?.id) {
        setSelectedDetailsOrder((prev) => (prev ? { ...prev, ...data.order } : data.order));
      }
      setRateModalOrder(null);
    },
    onError: (err: Error) => alert(`Ошибка изменения ставки: ${err.message}`),
  });

  return {
    queryClient,
    orders,
    isLoading,
    vehicles,
    drivers,
    counterparties,
    presets,
    loadingPoints,
    autoProgressMutation,
    assignMutation,
    completeOrderMutation,
    deleteOrderMutation,
    billingDocsMutation,
    manualStageMutation,
    updateRateMutation,
  };
}
