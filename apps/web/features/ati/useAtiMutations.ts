'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AtiApiResponse } from './types';

export function useAtiMutations({
  onOrderCancelled,
  onOrderCreated,
}: {
  onOrderCancelled: () => void;
  onOrderCreated: () => void;
}) {
  const queryClient = useQueryClient();

  const query = useQuery<AtiApiResponse>({
    queryKey: ['ati-orders'],
    queryFn: async () => {
      const res = await fetch('/api/ati');
      if (!res.ok) throw new Error('Ошибка загрузки заявок АТИ');
      return res.json();
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const invalidateAtiAndReceivables = () => {
    queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
  };

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: number }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Ошибка обновления этапа');
      }
      return res.json();
    },
    onSuccess: invalidateAtiAndReceivables,
    onError: (err: Error) => alert(err.message),
  });

  const updateDocFieldsMutation = useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: {
      id: string;
      postal_tracking_number?: string;
      docs_sent?: boolean;
      docs_sent_date?: string | null;
      docs_received?: boolean;
      docs_received_date?: string | null;
      payment_promised_date?: string | null;
      stage?: number;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error('Ошибка обновления статуса документов');
      return res.json();
    },
    onSuccess: invalidateAtiAndReceivables,
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      reason: string;
      has_claim?: boolean;
      claim_status?: 'issued';
      claim_number?: string;
      claim_date?: string;
      claim_amount?: number;
      claim_penalty_amount?: number;
      claim_empty_run_amount?: number;
      claim_idle_amount?: number;
      claim_due_days?: number;
    }) => {
      const res = await fetch(`/api/ati/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_cancelled: true,
          cancel_reason: payload.reason,
          has_claim: payload.has_claim,
          claim_status: payload.claim_status,
          claim_number: payload.claim_number,
          claim_date: payload.claim_date,
          claim_amount: payload.claim_amount,
          claim_penalty_amount: payload.claim_penalty_amount,
          claim_empty_run_amount: payload.claim_empty_run_amount,
          claim_idle_amount: payload.claim_idle_amount,
          claim_due_days: payload.claim_due_days,
        }),
      });
      if (!res.ok) throw new Error('Ошибка обработки срыва заявки');
      return res.json();
    },
    onSuccess: () => {
      invalidateAtiAndReceivables();
      onOrderCancelled();
    },
  });

  const updateClaimStatusMutation = useMutation({
    mutationFn: async ({
      id,
      claim_status,
      claim_agreed_at,
      claim_amount,
      claim_notes,
    }: {
      id: string;
      claim_status?: 'issued' | 'agreed' | 'waiting_payment' | 'paid' | 'rejected';
      claim_agreed_at?: string;
      claim_amount?: number;
      claim_notes?: string;
    }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_status,
          claim_agreed_at:
            claim_agreed_at || (claim_status === 'agreed' ? new Date().toISOString() : undefined),
          claim_amount,
          claim_notes,
        }),
      });
      if (!res.ok) throw new Error('Ошибка обновления претензии');
      return res.json();
    },
    onSuccess: invalidateAtiAndReceivables,
  });

  const restoreOrderMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/ati/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) throw new Error('Ошибка восстановления заявки');
      return res.json();
    },
    onSuccess: invalidateAtiAndReceivables,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/ati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Ошибка создания заявки');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ati-orders'] });
      queryClient.invalidateQueries({ queryKey: ['counterparties'] });
      onOrderCreated();
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    updateStageMutation,
    updateDocFieldsMutation,
    cancelOrderMutation,
    updateClaimStatusMutation,
    restoreOrderMutation,
    createOrderMutation,
  };
}
