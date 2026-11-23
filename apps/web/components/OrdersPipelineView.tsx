'use client';

import { useState, useSyncExternalStore } from 'react';
import { PIPELINE_FOLDERS } from '@/features/orders/constants';
import { DriverEditModal } from '@/features/orders/DriverEditModal';
import {
  EpeDocModal,
  InvoiceDocModal,
  WaybillDocModal,
} from '@/features/orders/OrderBillingModals';
import { OrderDetailsModal } from '@/features/orders/OrderDetailsModal';
import { OrderPipelineRow } from '@/features/orders/OrderPipelineRow';
import { AssignVehicleModal, QuickRateModal } from '@/features/orders/OrderQuickActionModals';
import { CreateSmartOrderModal } from '@/features/orders/smart-order/CreateSmartOrderModal';
import type { BillingDocsWorkflow, OrderItem, PipelineFolderId } from '@/features/orders/types';
import { useOrdersPipelineData } from '@/features/orders/useOrdersPipelineData';
import {
  formatMonthLabel,
  getFolderOrders,
  getOrderEffectiveClientName,
} from '@/features/orders/utils';
import { DocumentTemplatesModal } from './DocumentTemplatesModal';

export type {
  BillingDocsWorkflow,
  ClientOrderPart,
  OrderItem,
  RouteStop,
} from '@/features/orders/types';
export {
  getDocCounterpartyBadge,
  getOrderEffectiveClientName,
  isStrictDocCounterparty,
} from '@/features/orders/utils';

const STORAGE_KEY = 'salda_orders_active_folder';
const VALID_FOLDERS: PipelineFolderId[] = [
  'waiting_vehicle',
  'assigned',
  'in_progress',
  'pending_review',
  'docs_collection',
  'completed',
];

function readSavedFolder(): PipelineFolderId {
  if (typeof window === 'undefined') return 'in_progress';
  const saved = localStorage.getItem(STORAGE_KEY) as PipelineFolderId | null;
  return saved && VALID_FOLDERS.includes(saved) ? saved : 'in_progress';
}

const folderListeners = new Set<() => void>();
function subscribeFolder(cb: () => void) {
  folderListeners.add(cb);
  return () => folderListeners.delete(cb);
}

export function OrdersPipelineView() {
  const activeFolder = useSyncExternalStore<PipelineFolderId>(
    subscribeFolder,
    readSavedFolder,
    () => 'in_progress',
  );

  const setActiveFolder = (folder: PipelineFolderId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, folder);
      folderListeners.forEach((cb) => cb());
    }
  };

  const [archiveMonth, setArchiveMonth] = useState<string>('all');
  const [archiveDay, setArchiveDay] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [docClientFilter, setDocClientFilter] = useState<'all' | 'vsmpo' | 'avisma' | 'geostroy'>(
    'all',
  );

  const [invoiceModalOrder, setInvoiceModalOrder] = useState<{
    order: OrderItem;
    initialStep5?: boolean;
  } | null>(null);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [invoiceDateInput, setInvoiceDateInput] = useState('');

  const [waybillModalOrder, setWaybillModalOrder] = useState<{ order: OrderItem } | null>(null);
  const [waybillTypeInput, setWaybillTypeInput] = useState<'paper' | 'etrn'>('paper');
  const [waybillNumberInput, setWaybillNumberInput] = useState('');
  const [waybillDeliveredInput, setWaybillDeliveredInput] = useState(true);

  const [epeModalOrder, setEpeModalOrder] = useState<{ order: OrderItem } | null>(null);
  const [epeNumberInput, setEpeNumberInput] = useState('');
  const [epeReceivedInput, setEpeReceivedInput] = useState(true);

  const [rateModalOrder, setRateModalOrder] = useState<OrderItem | null>(null);
  const [rateInput, setRateInput] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [selectedDetailsOrder, setSelectedDetailsOrder] = useState<OrderItem | null>(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [driverModalInitialId, setDriverModalInitialId] = useState<string | undefined>(undefined);
  const [assignModalOrder, setAssignModalOrder] = useState<OrderItem | null>(null);
  const [isDocTemplatesModalOpen, setIsDocTemplatesModalOpen] = useState(false);

  const {
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
  } = useOrdersPipelineData({
    selectedDetailsOrder,
    setSelectedDetailsOrder,
    assignModalOrder,
    setAssignModalOrder,
    setRateModalOrder,
  });

  const handleOpenWaybillModal = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    const type = cur.waybill_type || 'paper';
    setWaybillTypeInput(type);
    setWaybillNumberInput(cur.waybill_number || order.waybill_number || '');
    setWaybillDeliveredInput(
      type === 'etrn' ? Boolean(cur.etrn_signed_edo) : Boolean(cur.tn_driver_delivered ?? true),
    );
    setWaybillModalOrder({ order });
  };

  const handleSaveWaybill = (isReset = false) => {
    if (!waybillModalOrder) return;
    const { order } = waybillModalOrder;
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: {
        ...cur,
        waybill_type: waybillTypeInput,
        waybill_number: isReset ? null : waybillNumberInput.trim() || null,
        tn_driver_delivered: isReset
          ? false
          : waybillTypeInput === 'paper'
            ? waybillDeliveredInput
            : false,
        etrn_signed_edo: isReset
          ? false
          : waybillTypeInput === 'etrn'
            ? waybillDeliveredInput
            : false,
      },
    });
    setWaybillModalOrder(null);
  };

  const handleOpenEpeModal = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    setEpeNumberInput(cur.epe_number || order.base_doc_number || '');
    setEpeReceivedInput(cur.epe_received_edo ?? true);
    setEpeModalOrder({ order });
  };

  const handleSaveEpe = (isReset = false) => {
    if (!epeModalOrder) return;
    const { order } = epeModalOrder;
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: {
        ...cur,
        epe_received_edo: isReset ? false : epeReceivedInput,
        epe_number: isReset ? null : epeNumberInput.trim() || null,
      },
    });
    setEpeModalOrder(null);
  };

  const handleToggleDocsSent = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    billingDocsMutation.mutate({
      orderId: order.id,
      docs: {
        ...cur,
        docs_sent_edo: !cur.docs_sent_edo,
        docs_sent_at: !cur.docs_sent_edo ? new Date().toISOString() : null,
      },
    });
  };

  const handleOpenInvoiceModal = (order: OrderItem, initialStep5 = false) => {
    const cur = order.billing_docs || {};
    setInvoiceNumberInput(
      cur.invoice_number || order.base_doc_number || `СЧ-${order.order_number}`,
    );
    setInvoiceDateInput(cur.invoice_date || new Date().toISOString().slice(0, 10));
    setInvoiceModalOrder({ order, initialStep5 });
  };

  const handleSaveInvoice = (isIssued: boolean) => {
    if (!invoiceModalOrder) return;
    const { order, initialStep5 } = invoiceModalOrder;
    const trimmed = invoiceNumberInput.trim();
    if (isIssued && !trimmed) {
      alert('Пожалуйста, укажите номер счёта');
      return;
    }
    const cur = order.billing_docs || {};
    const updatedDocs: Partial<BillingDocsWorkflow> = {
      ...cur,
      invoice_issued: isIssued,
      invoice_number: isIssued ? trimmed : null,
      invoice_date: isIssued ? invoiceDateInput : null,
    };
    if (initialStep5 && isIssued) {
      updatedDocs.client_accepted_edo = true;
      updatedDocs.status = 'accepted';
    }
    billingDocsMutation.mutate({ orderId: order.id, docs: updatedDocs });
    setInvoiceModalOrder(null);
  };

  const handleStep5Click = (order: OrderItem) => {
    const cur = order.billing_docs || {};
    if (cur.client_accepted_edo) {
      if (
        confirm(
          `Вернуть рейс № ${order.base_doc_number || order.order_number} из архива в работу над документами?`,
        )
      ) {
        billingDocsMutation.mutate({
          orderId: order.id,
          docs: { ...cur, client_accepted_edo: false, status: 'in_progress' },
        });
      }
      return;
    }
    if (!cur.invoice_number) {
      handleOpenInvoiceModal(order, true);
      return;
    }
    if (
      confirm(
        `Подтвердить: Контрагент подписал документы в ЭДО и поставил в ОПЛАТУ?\n\n` +
          `• Счёт № ${cur.invoice_number} появится в Дебиторке (статус "Выставить счёт" снимется)\n` +
          `• Рейс исчезнет из раздела "Документы"`,
      )
    ) {
      billingDocsMutation.mutate({
        orderId: order.id,
        docs: { ...cur, client_accepted_edo: true, status: 'accepted' },
      });
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(o.trip?.trip_number || '').includes(q) ||
      o.base_doc_number?.toLowerCase().includes(q) ||
      String(o.order_number).includes(q) ||
      o.client?.name?.toLowerCase().includes(q) ||
      o.cargo_name?.toLowerCase().includes(q) ||
      o.vehicle?.reg_number?.toLowerCase().includes(q) ||
      o.driver?.name?.toLowerCase().includes(q)
    );
  });

  const archiveMonths = Array.from(
    new Set(
      getFolderOrders('completed', orders)
        .map((o) => {
          const dt = o.trip?.started_at || o.created_at;
          return dt ? dt.slice(0, 7) : null;
        })
        .filter((x): x is string => Boolean(x)),
    ),
  ).sort((a, b) => b.localeCompare(a));

  const activeFolderMeta =
    PIPELINE_FOLDERS.find((f) => f.id === activeFolder) || PIPELINE_FOLDERS[0]!;

  const activeFolderOrders = getFolderOrders(activeFolder, filteredOrders).filter((o) => {
    if (activeFolder === 'docs_collection' && docClientFilter !== 'all') {
      const name = getOrderEffectiveClientName(o).toLowerCase();
      if (docClientFilter === 'vsmpo' && !name.includes('всмпо')) return false;
      if (docClientFilter === 'avisma' && !name.includes('ависма')) return false;
      if (docClientFilter === 'geostroy' && !name.includes('геострой')) return false;
    }
    if (activeFolder === 'completed') {
      const iso = (o.trip?.started_at || o.created_at || '').slice(0, 10);
      if (archiveDay && iso !== archiveDay) return false;
      if (!archiveDay && archiveMonth !== 'all' && !iso.startsWith(archiveMonth)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3.5 font-sans">
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-[15px] font-extrabold text-slate-900 flex items-center gap-2">
            <span>📝 Конвейер заявок & Wialon</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Синхронно с Ревью и Wialon
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Поиск по № рейса, клиенту, машине..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white w-60"
          />
          <button
            onClick={() => {
              setDriverModalInitialId(undefined);
              setIsDriverModalOpen(true);
            }}
            title="Справочник водителей: паспорт, права, ИНН и телефон для печати 4-С и ТН"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>👤 Водители ({drivers.length})</span>
          </button>
          <button
            onClick={() => setIsDocTemplatesModalOpen(true)}
            title="Шаблоны Путевых листов (4-С), Транспортных накладных (ТН), ЭТрН"
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>📋 Шаблоны</span>
          </button>
          <button
            onClick={() => {
              setEditingOrder(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition active:scale-95"
          >
            <span>+ Новая заявка</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {PIPELINE_FOLDERS.map((folder) => {
          const count = getFolderOrders(folder.id, orders).length;
          const isActive = activeFolder === folder.id;
          return (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className={`text-left rounded-xl px-3.5 py-2.5 border transition-all cursor-pointer flex flex-col gap-1.5 ${
                isActive
                  ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:-translate-y-0.5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[12.5px] font-bold truncate ${
                    isActive ? 'text-emerald-900' : 'text-slate-800'
                  }`}
                >
                  {folder.icon} {folder.name}
                </span>
                <span
                  className={`text-[11.5px] font-extrabold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : count > 0 && folder.id === 'docs_collection'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </div>
              <div
                className={`text-[11px] truncate ${
                  isActive ? 'text-emerald-700/80' : 'text-slate-500'
                }`}
              >
                {folder.sub}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-[13px] font-bold text-slate-700 flex items-center gap-2">
          <span>
            {activeFolderMeta.icon} {activeFolderMeta.name}
          </span>
          <span className="text-[11.5px] font-medium text-slate-500">
            — {activeFolderMeta.sub} ({activeFolderOrders.length})
          </span>
        </div>

        {activeFolder === 'docs_collection' && (
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
            {(
              [
                { id: 'all', label: 'Все клиенты' },
                { id: 'vsmpo', label: 'ВСМПО-АВИСМА' },
                { id: 'avisma', label: 'ООО АВИСМА' },
                { id: 'geostroy', label: 'Геостройиндустрия' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setDocClientFilter(f.id)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  docClientFilter === f.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {activeFolder === 'completed' && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={archiveMonth}
              onChange={(e) => {
                setArchiveMonth(e.target.value);
                setArchiveDay('');
              }}
              className="border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
            >
              <option value="all">Все месяцы</option>
              {archiveMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthLabel(ym)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={archiveDay}
              onChange={(e) => setArchiveDay(e.target.value)}
              title="Фильтр по конкретному дню"
              className="border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
            />
            {(archiveMonth !== 'all' || archiveDay) && (
              <button
                onClick={() => {
                  setArchiveMonth('all');
                  setArchiveDay('');
                }}
                className="px-2.5 py-1 text-xs font-bold bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
              >
                Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs font-bold text-slate-400">
          Загрузка заявок...
        </div>
      ) : activeFolderOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-xs font-semibold text-slate-500">
          В папке «{activeFolderMeta.name}» нет заявок по выбранным фильтрам
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {activeFolderOrders.map((order) => (
            <OrderPipelineRow
              key={order.id}
              order={order}
              activeFolder={activeFolder}
              onSelect={setSelectedDetailsOrder}
              onOpenWaybill={handleOpenWaybillModal}
              onOpenEpe={handleOpenEpeModal}
              onOpenInvoice={(o) => handleOpenInvoiceModal(o, false)}
              onToggleDocsSent={handleToggleDocsSent}
              onStep5Click={handleStep5Click}
              onOpenRate={(o) => {
                setRateModalOrder(o);
                setRateInput(o.price_without_vat ? String(o.price_without_vat) : '');
              }}
              onOpenAssign={setAssignModalOrder}
              onManualStage={(orderId, stage) => manualStageMutation.mutate({ orderId, stage })}
            />
          ))}
        </div>
      )}

      {invoiceModalOrder && (
        <InvoiceDocModal
          order={invoiceModalOrder.order}
          invoiceNumberInput={invoiceNumberInput}
          setInvoiceNumberInput={setInvoiceNumberInput}
          invoiceDateInput={invoiceDateInput}
          setInvoiceDateInput={setInvoiceDateInput}
          onSave={handleSaveInvoice}
          onClose={() => setInvoiceModalOrder(null)}
        />
      )}

      {waybillModalOrder && (
        <WaybillDocModal
          order={waybillModalOrder.order}
          waybillTypeInput={waybillTypeInput}
          setWaybillTypeInput={setWaybillTypeInput}
          waybillNumberInput={waybillNumberInput}
          setWaybillNumberInput={setWaybillNumberInput}
          waybillDeliveredInput={waybillDeliveredInput}
          setWaybillDeliveredInput={setWaybillDeliveredInput}
          onSave={handleSaveWaybill}
          onClose={() => setWaybillModalOrder(null)}
        />
      )}

      {epeModalOrder && (
        <EpeDocModal
          order={epeModalOrder.order}
          epeNumberInput={epeNumberInput}
          setEpeNumberInput={setEpeNumberInput}
          epeReceivedInput={epeReceivedInput}
          setEpeReceivedInput={setEpeReceivedInput}
          onSave={handleSaveEpe}
          onClose={() => setEpeModalOrder(null)}
        />
      )}

      {rateModalOrder && (
        <QuickRateModal
          order={rateModalOrder}
          rateInput={rateInput}
          setRateInput={setRateInput}
          isPending={updateRateMutation.isPending}
          onSave={() => {
            const parsed = Number(rateInput.replace(/\s+/g, ''));
            if (isNaN(parsed) || parsed < 0) {
              alert('Пожалуйста, укажите корректную сумму ставки');
              return;
            }
            updateRateMutation.mutate({ orderId: rateModalOrder.id, priceWithoutVat: parsed });
          }}
          onClose={() => setRateModalOrder(null)}
        />
      )}

      {selectedDetailsOrder && (
        <OrderDetailsModal
          order={selectedDetailsOrder}
          onClose={() => setSelectedDetailsOrder(null)}
          onEdit={() => {
            setEditingOrder(selectedDetailsOrder);
            setSelectedDetailsOrder(null);
            setIsCreateModalOpen(true);
          }}
          onQuickEditRate={(o) => {
            setRateModalOrder(o);
            setRateInput(o.price_without_vat ? String(o.price_without_vat) : '');
          }}
          onAssignVehicle={() => {
            setAssignModalOrder(selectedDetailsOrder);
            setSelectedDetailsOrder(null);
          }}
          onDepart={() =>
            autoProgressMutation.mutate({ orderId: selectedDetailsOrder.id, action: 'depart' })
          }
          onArrive={() =>
            autoProgressMutation.mutate({
              orderId: selectedDetailsOrder.id,
              action: 'arrive',
              forceFinish: false,
            })
          }
          onComplete={() => completeOrderMutation.mutate(selectedDetailsOrder.id)}
          onManualStage={(stage) =>
            manualStageMutation.mutate({ orderId: selectedDetailsOrder.id, stage })
          }
          onDelete={() => {
            const num = selectedDetailsOrder.base_doc_number || selectedDetailsOrder.order_number;
            if (window.confirm(`Вы уверены, что хотите удалить заявку № ${num}?`)) {
              deleteOrderMutation.mutate(selectedDetailsOrder.id);
            }
          }}
          onOpenDocTemplates={() => setIsDocTemplatesModalOpen(true)}
        />
      )}

      {isCreateModalOpen && (
        <CreateSmartOrderModal
          initialOrder={editingOrder}
          presets={presets}
          loadingPoints={loadingPoints}
          counterparties={counterparties}
          vehicles={vehicles}
          drivers={drivers}
          onOpenDriverModal={(driverId) => {
            setDriverModalInitialId(driverId);
            setIsDriverModalOpen(true);
          }}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
            queryClient.invalidateQueries({ queryKey: ['orders-pipeline'] });
          }}
        />
      )}

      {isDriverModalOpen && (
        <DriverEditModal
          drivers={drivers}
          initialDriverId={driverModalInitialId}
          onClose={() => setIsDriverModalOpen(false)}
          onSaved={() => {
            setIsDriverModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['drivers-list'] });
          }}
        />
      )}

      {assignModalOrder && (
        <AssignVehicleModal
          order={assignModalOrder}
          vehicles={vehicles}
          drivers={drivers}
          isPending={assignMutation.isPending}
          onOpenDriverModal={() => {
            setDriverModalInitialId(undefined);
            setIsDriverModalOpen(true);
          }}
          onAssign={(vehicleId, driverId) =>
            assignMutation.mutate({ orderId: assignModalOrder.id, vehicleId, driverId })
          }
          onClose={() => setAssignModalOrder(null)}
        />
      )}

      <DocumentTemplatesModal
        isOpen={isDocTemplatesModalOpen}
        onClose={() => setIsDocTemplatesModalOpen(false)}
        counterparties={counterparties}
        loadingPoints={loadingPoints}
      />
    </div>
  );
}
