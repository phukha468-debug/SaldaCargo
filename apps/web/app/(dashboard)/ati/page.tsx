'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExpeditorBoard } from './expeditor-board';
import { OrdersPipelineView } from '@/components/OrdersPipelineView';
import { AtiAgreeClaimModal } from '@/features/ati/AtiAgreeClaimModal';
import { AtiCancelClaimModal } from '@/features/ati/AtiCancelClaimModal';
import { AtiCarrierBoard } from '@/features/ati/AtiCarrierBoard';
import { AtiClaimPrintModal } from '@/features/ati/AtiClaimPrintModal';
import {
  AtiClaimsArchiveModal,
  type AtiClaimsArchiveTab,
} from '@/features/ati/AtiClaimsArchiveModal';
import { AtiCreateOrderModal } from '@/features/ati/AtiCreateOrderModal';
import { AtiOrderDetailModal } from '@/features/ati/AtiOrderDetailModal';
import { AtiPowerOfAttorneyModal } from '@/features/ati/AtiPowerOfAttorneyModal';
import type { AgreeClaimState, AtiOrder } from '@/features/ati/types';
import { useAtiMutations } from '@/features/ati/useAtiMutations';
import { groupAtiOrdersByStage, partitionAtiOrders } from '@/features/ati/utils';

export type { AtiOrder } from '@/features/ati/types';

export default function AtiPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'carrier' | 'expeditor'>('pipeline');
  const [activeCarrierStage, setActiveCarrierStage] = useState<number>(1);
  const [filterDoc, setFilterDoc] = useState<'all' | 'etrn' | 'paper'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [cancellingOrder, setCancellingOrder] = useState<AtiOrder | null>(null);
  const [showCancelledList, setShowCancelledList] = useState(false);
  const [cancelledListTab, setCancelledListTab] = useState<AtiClaimsArchiveTab>('claims');
  const [viewingClaimOrder, setViewingClaimOrder] = useState<AtiOrder | null>(null);
  const [viewingPowerOfAttorney, setViewingPowerOfAttorney] = useState<AtiOrder | null>(null);
  const [agreeingClaim, setAgreeingClaim] = useState<AgreeClaimState | null>(null);

  const {
    data,
    isLoading,
    updateStageMutation,
    updateDocFieldsMutation,
    cancelOrderMutation,
    updateClaimStatusMutation,
    restoreOrderMutation,
    createOrderMutation,
  } = useAtiMutations({
    onOrderCancelled: () => {
      setCancellingOrder(null);
      setSelectedOrderId(null);
    },
    onOrderCreated: () => {
      setIsNewModalOpen(false);
    },
  });

  const orders = useMemo(() => data?.orders || [], [data?.orders]);
  const counterparties = useMemo(() => data?.counterparties || [], [data?.counterparties]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) || null : null),
    [orders, selectedOrderId],
  );

  const {
    cancelledOrders,
    claimOrders,
    activeClaimOrders,
    paidClaimOrders,
    simpleCancelledOrders,
    activeOrders,
    activeClaimsSum,
    paidClaimsSum,
    totalFreight,
    inReceivables,
  } = useMemo(() => partitionAtiOrders(orders), [orders]);

  const ordersByStage = useMemo(
    () => groupAtiOrdersByStage(activeOrders, filterDoc),
    [activeOrders, filterDoc],
  );

  const openAgreeClaimModal = (ord: AtiOrder) => {
    const freight = Number(ord.price || 30000);
    const defaultAmount =
      ord.claim_status === 'issued'
        ? Math.round(freight * 0.1)
        : Number(ord.claim_amount || Math.round(freight * 0.2));
    setAgreeingClaim({
      order: ord,
      amount: String(defaultAmount),
      notes:
        ord.claim_notes ||
        (ord.claim_status === 'issued'
          ? 'Согласовано 10% от фрахта без бюрократических проволочек'
          : ''),
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (viewingPowerOfAttorney) setViewingPowerOfAttorney(null);
      else if (viewingClaimOrder) setViewingClaimOrder(null);
      else if (agreeingClaim) setAgreeingClaim(null);
      else if (cancellingOrder) setCancellingOrder(null);
      else if (showCancelledList) setShowCancelledList(false);
      else if (isNewModalOpen) setIsNewModalOpen(false);
      else if (selectedOrderId) setSelectedOrderId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewingPowerOfAttorney,
    viewingClaimOrder,
    agreeingClaim,
    cancellingOrder,
    showCancelledList,
    isNewModalOpen,
    selectedOrderId,
  ]);

  return (
    <div className="w-full space-y-2 pb-6">
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
            {activeTab === 'pipeline' ? '📝' : activeTab === 'carrier' ? '🚚' : '📦'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-display">
                ЗАЯВКИ ГРУЗОВИКИ
              </h1>
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('pipeline')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'pipeline'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <span>📝 Конвейер заявок & Wialon</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('carrier')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'carrier'
                      ? 'bg-white text-indigo-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <span>🚚 Канбан договоров АТИ</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                    {activeOrders.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('expeditor')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'expeditor'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-indigo-700 hover:text-indigo-950'
                  }`}
                >
                  <span>📦 Мы — Экспедитор</span>
                  <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.2 rounded-full font-mono font-bold">
                    Новое
                  </span>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {activeTab === 'pipeline'
                ? 'Единый сквозной цикл: входящие заявки (АТИ, Логинет, реклама) → авто-старт Wialon → ЭТрН, ТН и путевой лист'
                : activeTab === 'carrier'
                  ? 'Свой автопарк: Канбан договоров АТИ, 7 этапов, отслеживание документов, претензионная работа 20%'
                  : 'Организация перевозок: привлечение сторонних перевозчиков, работа с физлицами и B2B, контроль маржи'}
            </p>
          </div>
        </div>

        {activeTab === 'carrier' && (
          <div className="flex items-center gap-2 flex-wrap self-end xl:self-center">
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-300 text-xs font-bold">
              <button
                onClick={() => setFilterDoc('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDoc === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:bg-white/50'
                }`}
              >
                Все ({activeOrders.length})
              </button>
              <button
                onClick={() => setFilterDoc('etrn')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDoc === 'etrn'
                    ? 'bg-white text-emerald-800 shadow-2xs font-black'
                    : 'text-emerald-700 hover:bg-white/50'
                }`}
              >
                ⚡ ЭТрН ({activeOrders.filter((o) => o.doc_type === 'etrn').length})
              </button>
              <button
                onClick={() => setFilterDoc('paper')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDoc === 'paper'
                    ? 'bg-white text-amber-900 shadow-2xs font-black'
                    : 'text-amber-800 hover:bg-white/50'
                }`}
              >
                📮 Почта РФ ({activeOrders.filter((o) => o.doc_type === 'paper').length})
              </button>
            </div>

            {claimOrders.length > 0 && (
              <button
                onClick={() => {
                  setCancelledListTab(activeClaimOrders.length > 0 ? 'claims' : 'claims_archive');
                  setShowCancelledList(true);
                }}
                className={`px-2.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs ${
                  activeClaimOrders.length > 0
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300'
                }`}
                title="Претензии к заказчикам за срыв погрузки (активные и архив)"
              >
                <span>
                  {activeClaimOrders.length > 0 ? '⚖️ Претензии:' : '📁 Архив претензий:'}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full font-mono text-[11px] font-black ${
                    activeClaimOrders.length > 0
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-emerald-200 text-emerald-950'
                  }`}
                >
                  {activeClaimOrders.length > 0 ? activeClaimOrders.length : paidClaimOrders.length}
                </span>
                {activeClaimsSum > 0 ? (
                  <span className="text-[10px] font-mono font-black text-amber-800">
                    ({activeClaimsSum.toLocaleString('ru-RU')} ₽)
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 font-bold">
                    (оплачено {paidClaimsSum.toLocaleString('ru-RU')} ₽ ✓)
                  </span>
                )}
              </button>
            )}

            {simpleCancelledOrders.length > 0 && (
              <button
                onClick={() => {
                  setCancelledListTab('simple');
                  setShowCancelledList(true);
                }}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
                title="Сорванные рейсы без претензий"
              >
                <span>❌ Срывы:</span>
                <span className="font-black bg-slate-200 text-slate-900 px-1.5 py-0.2 rounded-full font-mono text-[11px]">
                  {simpleCancelledOrders.length}
                </span>
              </button>
            )}

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <span>＋</span>
              <span>Новая заявка АТИ</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'pipeline' ? (
        <OrdersPipelineView />
      ) : activeTab === 'expeditor' ? (
        <ExpeditorBoard />
      ) : (
        <>
          <AtiCarrierBoard
            isLoading={isLoading}
            activeClaimOrders={activeClaimOrders}
            activeClaimsSum={activeClaimsSum}
            totalFreight={totalFreight}
            inReceivables={inReceivables}
            ordersByStage={ordersByStage}
            activeCarrierStage={activeCarrierStage}
            setActiveCarrierStage={setActiveCarrierStage}
            claimUpdatePending={updateClaimStatusMutation.isPending}
            onSelectOrder={(ord) => setSelectedOrderId(ord.id)}
            onOpenCancelModal={(ord) => setCancellingOrder(ord)}
            onUpdateStage={(id, stage) => updateStageMutation.mutate({ id, stage })}
            onOpenClaimPrint={(ord) => setViewingClaimOrder(ord)}
            onOpenAgreeClaim={openAgreeClaimModal}
            onMarkClaimPaid={(id) => updateClaimStatusMutation.mutate({ id, claim_status: 'paid' })}
          />

          {selectedOrder && (
            <AtiOrderDetailModal
              order={selectedOrder}
              onClose={() => setSelectedOrderId(null)}
              onOpenCancelModal={(ord) => setCancellingOrder(ord)}
              onUpdateStage={(id, stage) => updateStageMutation.mutate({ id, stage })}
              onUpdateDocFields={(payload) => updateDocFieldsMutation.mutate(payload)}
              onOpenPowerOfAttorney={(ord) => setViewingPowerOfAttorney(ord)}
            />
          )}

          {isNewModalOpen && (
            <AtiCreateOrderModal
              counterparties={counterparties}
              isPending={createOrderMutation.isPending}
              onSubmit={(payload) => createOrderMutation.mutate(payload)}
              onClose={() => setIsNewModalOpen(false)}
            />
          )}

          {cancellingOrder && (
            <AtiCancelClaimModal
              order={cancellingOrder}
              isPending={cancelOrderMutation.isPending}
              onSubmitCancel={(payload) => cancelOrderMutation.mutate(payload)}
              onClose={() => setCancellingOrder(null)}
            />
          )}

          {showCancelledList && (
            <AtiClaimsArchiveModal
              cancelledCount={cancelledOrders.length}
              activeTab={cancelledListTab}
              onChangeTab={setCancelledListTab}
              activeClaimOrders={activeClaimOrders}
              paidClaimOrders={paidClaimOrders}
              paidClaimsSum={paidClaimsSum}
              simpleCancelledOrders={simpleCancelledOrders}
              restorePending={restoreOrderMutation.isPending}
              claimUpdatePending={updateClaimStatusMutation.isPending}
              onOpenAgreeClaim={openAgreeClaimModal}
              onOpenClaimPrint={(ord) => setViewingClaimOrder(ord)}
              onRestoreOrder={(id) => restoreOrderMutation.mutate({ id })}
              onUpdateClaimStatus={(payload) => updateClaimStatusMutation.mutate(payload)}
              onOpenClaimForSimple={(ord) => {
                setShowCancelledList(false);
                setCancellingOrder(ord);
              }}
              onClose={() => setShowCancelledList(false)}
            />
          )}

          {viewingClaimOrder && (
            <AtiClaimPrintModal
              order={viewingClaimOrder}
              onClose={() => setViewingClaimOrder(null)}
            />
          )}

          {viewingPowerOfAttorney && (
            <AtiPowerOfAttorneyModal
              order={viewingPowerOfAttorney}
              onClose={() => setViewingPowerOfAttorney(null)}
            />
          )}

          {agreeingClaim && (
            <AtiAgreeClaimModal
              agreeingClaim={agreeingClaim}
              isPending={updateClaimStatusMutation.isPending}
              onChange={setAgreeingClaim}
              onConfirm={() => {
                const finalAmount = Number(agreeingClaim.amount) || 0;
                updateClaimStatusMutation.mutate(
                  {
                    id: agreeingClaim.order.id,
                    claim_status: 'agreed',
                    claim_amount: finalAmount,
                    claim_notes: agreeingClaim.notes,
                  },
                  {
                    onSuccess: () => {
                      setAgreeingClaim(null);
                    },
                  },
                );
              }}
              onClose={() => setAgreeingClaim(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
