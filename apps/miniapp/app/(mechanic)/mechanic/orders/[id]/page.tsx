'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@saldacargo/ui';

interface CatalogItem {
  id: string;
  name: string;
  norm_minutes: number;
}

interface Part {
  id: string;
  name: string;
  article?: string;
  unit: string;
  stock: number;
}

interface WorkItem {
  id: string;
  work_catalog?: { name: string; norm_minutes: number };
  custom_work_name?: string;
  status: string;
  actual_minutes: number;
  extra_work_status?: 'pending_approval' | 'approved' | 'rejected' | null;
  extra_work_mechanic_note?: string | null;
  time_logs: Array<{ started_at: string; stopped_at: string | null; status: string }>;
}

interface OrderDetail {
  id: string;
  order_number: number;
  status: string;
  lifecycle_status: string;
  machine_type: 'own' | 'client';
  asset?: { short_name: string; reg_number: string };
  client_vehicle_brand?: string;
  client_vehicle_reg?: string;
  problem_description: string;
  assigned_mechanic_id?: string;
  admin_note?: string;
  works: WorkItem[];
  parts: Array<{
    id: string;
    part: { name: string; unit: string };
    quantity: number;
  }>;
}

// ─── BottomSheet ──────────────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] transition-all duration-300',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[90vh] flex flex-col transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 text-xl rounded-full active:bg-slate-100"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 pb-2">{children}</div>
        {footer && (
          <div className="shrink-0 px-4 py-4 border-t border-slate-100 bg-white">{footer}</div>
        )}
      </div>
    </div>
  );
}

// ─── AddWorkModal ─────────────────────────────────────────────────────────────

function AddWorkModal({
  open,
  onClose,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customNorm, setCustomNorm] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedCatalogId(null);
      setCustomName('');
      setCustomNorm('');
      setValidationError('');
      setTab('catalog');
    }
  }, [open]);

  const { data: catalog = [] } = useQuery<CatalogItem[]>({
    queryKey: ['work-catalog'],
    queryFn: async () => {
      const r = await fetch('/api/mechanic/catalog');
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch(`/api/mechanic/orders/${orderId}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Ошибка сервера');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      onClose();
    },
    onError: (e: Error) => setValidationError(e.message),
  });

  const handleAdd = () => {
    setValidationError('');
    if (tab === 'catalog') {
      if (!selectedCatalogId) {
        setValidationError('Выберите работу из каталога');
        return;
      }
      addMutation.mutate({ work_catalog_id: selectedCatalogId });
    } else {
      if (!customName.trim()) {
        setValidationError('Введите название работы');
        return;
      }
      addMutation.mutate({
        custom_work_name: customName.trim(),
        norm_minutes: customNorm ? Number(customNorm) : 0,
      });
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Добавить работу"
      footer={
        <div>
          {validationError && (
            <p className="text-xs text-red-500 font-bold mb-2 text-center">{validationError}</p>
          )}
          <button
            onClick={handleAdd}
            disabled={addMutation.isPending}
            className="w-full bg-orange-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:bg-orange-400"
          >
            {addMutation.isPending ? 'Добавляем...' : 'Добавить работу'}
          </button>
        </div>
      }
    >
      <div className="flex gap-2 mb-4">
        {(['catalog', 'custom'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setValidationError('');
            }}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors',
              tab === t ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-500',
            )}
          >
            {t === 'catalog' ? 'Из каталога' : 'Своя работа'}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        <div className="space-y-2">
          {catalog.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-xs text-slate-400 font-bold">Каталог пуст</p>
            </div>
          ) : (
            catalog.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedCatalogId(item.id === selectedCatalogId ? null : item.id);
                  setValidationError('');
                }}
                className={cn(
                  'w-full text-left p-4 rounded-xl border-2 transition-all active:scale-[0.98]',
                  selectedCatalogId === item.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-100 bg-white',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                  {selectedCatalogId === item.id && (
                    <span className="text-orange-600 text-lg">✓</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Норма: {item.norm_minutes} мин
                </p>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Название работы *
            </label>
            <input
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setValidationError('');
              }}
              placeholder="Например: Замена масла"
              className={cn(
                'w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400',
                validationError && !customName.trim()
                  ? 'border-red-400 bg-red-50'
                  : 'border-slate-200',
              )}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Норма (мин) — необязательно
            </label>
            <input
              type="number"
              value={customNorm}
              onChange={(e) => setCustomNorm(e.target.value)}
              placeholder="60"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// ─── ExtraWorkModal ───────────────────────────────────────────────────────────

function ExtraWorkModal({
  open,
  onClose,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [mechanicNote, setMechanicNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedCatalogId(null);
      setCustomName('');
      setMechanicNote('');
      setError('');
      setTab('catalog');
    }
  }, [open]);

  const { data: catalog = [] } = useQuery<CatalogItem[]>({
    queryKey: ['work-catalog'],
    queryFn: async () => {
      const r = await fetch('/api/mechanic/catalog');
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  const requestMutation = useMutation({
    mutationFn: async (body: object) => {
      const r = await fetch(`/api/mechanic/orders/${orderId}/extra-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Ошибка');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSend = () => {
    setError('');
    if (!mechanicNote.trim()) {
      setError('Опишите что обнаружили — это обязательно');
      return;
    }
    if (tab === 'catalog' && !selectedCatalogId) {
      setError('Выберите вид работы из каталога');
      return;
    }
    if (tab === 'custom' && !customName.trim()) {
      setError('Введите название работы');
      return;
    }
    requestMutation.mutate({
      work_catalog_id: tab === 'catalog' ? selectedCatalogId : undefined,
      custom_work_name: tab === 'custom' ? customName.trim() : undefined,
      mechanic_note: mechanicNote.trim(),
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Доп. работа → Согласование"
      footer={
        <div>
          {error && <p className="text-xs text-red-500 font-bold mb-2 text-center">{error}</p>}
          <button
            onClick={handleSend}
            disabled={requestMutation.isPending}
            className="w-full bg-amber-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:bg-amber-400"
          >
            {requestMutation.isPending ? 'Отправляем...' : '📤 Отправить на согласование'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            Обнаружили дополнительную работу? Выберите тип и опишите что нашли — администратор
            получит уведомление и одобрит или откажет.
          </p>
        </div>

        <div className="flex gap-2">
          {(['catalog', 'custom'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError('');
              }}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-colors',
                tab === t ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-500',
              )}
            >
              {t === 'catalog' ? 'Из каталога' : 'Описать'}
            </button>
          ))}
        </div>

        {tab === 'catalog' ? (
          <div className="space-y-2 max-h-44 overflow-y-auto">
            {catalog.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedCatalogId(item.id === selectedCatalogId ? null : item.id);
                  setError('');
                }}
                className={cn(
                  'w-full text-left p-3 rounded-xl border-2 transition-all active:scale-[0.98]',
                  selectedCatalogId === item.id
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-slate-100 bg-white',
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">{item.name}</p>
                  {selectedCatalogId === item.id && <span className="text-amber-600">✓</span>}
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                  Норма: {item.norm_minutes} мин
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Название работы *
            </label>
            <input
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setError('');
              }}
              placeholder="Например: Замена шаровой опоры"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
            Что обнаружили? *
          </label>
          <textarea
            value={mechanicNote}
            onChange={(e) => {
              setMechanicNote(e.target.value);
              setError('');
            }}
            placeholder="Опишите подробно что нашли и почему это нужно сделать..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── AddPartModal ─────────────────────────────────────────────────────────────

function AddPartModal({
  open,
  onClose,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [qty, setQty] = useState('1');
  const [orderRequested, setOrderRequested] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedPart(null);
      setQty('1');
      setOrderRequested(false);
    }
  }, [open]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, [search]);

  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: ['parts-search', debouncedSearch],
    queryFn: async () => {
      const r = await fetch(`/api/mechanic/parts?search=${encodeURIComponent(debouncedSearch)}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/mechanic/orders/${orderId}/parts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_id: selectedPart!.id, quantity: Number(qty) }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || 'Ошибка');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      onClose();
    },
  });

  const noStock = selectedPart ? selectedPart.stock <= 0 : false;

  return (
    <BottomSheet open={open} onClose={onClose} title="Запчасти">
      {!selectedPart ? (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или артикулу..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />
          {parts.length === 0 && debouncedSearch.length > 0 && (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-xs text-slate-500 font-bold">Ничего не найдено</p>
              <p className="text-xs text-slate-400 mt-1">
                Запчасть «{debouncedSearch}» отсутствует в базе
              </p>
            </div>
          )}
          {parts.length === 0 && debouncedSearch.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">Начните вводить название</p>
          )}
          <div className="space-y-2">
            {parts.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part)}
                className="w-full text-left p-3 rounded-xl border border-slate-100 bg-white active:bg-slate-50"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{part.name}</p>
                    {part.article && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {part.article}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-black px-2 py-0.5 rounded-full',
                      part.stock > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500',
                    )}
                  >
                    {part.stock > 0 ? `${part.stock} ${part.unit}` : 'Нет в наличии'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : noStock ? (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm font-black text-red-800">{selectedPart.name}</p>
            <p className="text-[10px] text-red-500 font-bold uppercase mt-1">
              Остаток: 0 {selectedPart.unit} — отсутствует на складе
            </p>
          </div>

          {!orderRequested ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Этой запчасти нет в наличии. Отправить администратору запрос на закупку?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPart(null)}
                  className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 text-xs font-black uppercase"
                >
                  Назад
                </button>
                <button
                  onClick={() => setOrderRequested(true)}
                  className="flex-[2] bg-zinc-900 text-white rounded-xl py-3 text-xs font-black uppercase active:scale-95 transition-transform"
                >
                  Заказать запчасть
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-3xl">✅</p>
              <p className="text-sm font-black text-slate-900">Запрос отправлен</p>
              <p className="text-xs text-slate-500">
                Администратор получит уведомление о закупке <strong>{selectedPart.name}</strong>
              </p>
              <button
                onClick={onClose}
                className="w-full bg-slate-100 text-slate-700 rounded-xl py-3 text-sm font-black uppercase"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-sm font-black text-green-900">{selectedPart.name}</p>
            <p className="text-[10px] text-green-600 font-bold uppercase mt-1">
              На складе: {selectedPart.stock} {selectedPart.unit}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
              Количество *
            </label>
            <input
              type="number"
              min="1"
              max={selectedPart.stock}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {Number(qty) > selectedPart.stock && (
              <p className="text-xs text-red-500 font-bold mt-1">
                Максимум {selectedPart.stock} {selectedPart.unit}
              </p>
            )}
          </div>
          {addMutation.isError && (
            <p className="text-xs text-red-500 font-bold">{(addMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPart(null)}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 text-xs font-black uppercase"
            >
              Назад
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={
                addMutation.isPending ||
                !qty ||
                Number(qty) <= 0 ||
                Number(qty) > selectedPart.stock
              }
              className="flex-[2] bg-orange-600 text-white rounded-xl py-3 text-xs font-black uppercase active:scale-95 transition-transform disabled:bg-orange-300"
            >
              {addMutation.isPending ? 'Списываем...' : 'Списать'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// ─── WorkCard ─────────────────────────────────────────────────────────────────

function WorkCard({
  work,
  now,
  onStart,
  onStop,
  isStarting,
  isStopping,
}: {
  work: WorkItem;
  now: number;
  onStart: () => void;
  onStop: (status: 'paused' | 'completed') => void;
  isStarting: boolean;
  isStopping: boolean;
}) {
  const activeLog = work.time_logs.find((l) => l.status === 'running');
  const isRunning = !!activeLog;

  let totalMinutes = work.actual_minutes || 0;
  if (isRunning) {
    const activeMs = now - new Date(activeLog.started_at).getTime();
    totalMinutes += Math.floor(activeMs / 60000);
  }

  const workName = work.work_catalog?.name || work.custom_work_name || 'Без названия';
  const normMins = work.work_catalog?.norm_minutes ?? 0;
  const isExtraWork = work.extra_work_status != null;
  const isPendingApproval = work.extra_work_status === 'pending_approval';
  const isRejected = work.extra_work_status === 'rejected';
  const canWork =
    !isPendingApproval && !isRejected && work.status !== 'completed' && work.status !== 'cancelled';

  const extraStatusLabel = () => {
    if (!isExtraWork) return null;
    const map: Record<string, { label: string; cls: string }> = {
      pending_approval: { label: 'На согласовании', cls: 'bg-amber-100 text-amber-700' },
      approved: { label: 'Согласовано', cls: 'bg-green-100 text-green-700' },
      rejected: { label: 'Отклонено', cls: 'bg-red-100 text-red-500' },
    };
    const entry = map[work.extra_work_status ?? ''];
    if (!entry) return null;
    return (
      <span className={cn('text-[8px] font-black uppercase px-1.5 py-0.5 rounded', entry.cls)}>
        {entry.label}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 p-4 transition-all',
        isRunning
          ? 'border-orange-500 shadow-lg shadow-orange-100'
          : isPendingApproval
            ? 'border-amber-300 bg-amber-50/30'
            : isRejected
              ? 'border-red-200 bg-red-50/30 opacity-60'
              : 'border-slate-100',
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-black text-slate-900 leading-tight">{workName}</p>
            {isExtraWork && (
              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                Доп.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {normMins > 0 && (
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Норма: {normMins}м · Факт: {totalMinutes}м
              </p>
            )}
            {extraStatusLabel()}
          </div>
          {isPendingApproval && work.extra_work_mechanic_note && (
            <p className="text-[10px] text-amber-700 mt-1 italic">
              «{work.extra_work_mechanic_note}»
            </p>
          )}
        </div>
        <span
          className={cn(
            'text-[9px] font-black uppercase px-2 py-1 rounded-full ml-2 shrink-0',
            isRunning
              ? 'bg-orange-600 text-white animate-pulse'
              : work.status === 'completed'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-400',
          )}
        >
          {isRunning ? 'В работе' : work.status === 'completed' ? 'Готово' : 'В очереди'}
        </span>
      </div>

      {canWork && (
        <div className="flex gap-2 mt-3">
          {isRunning ? (
            <>
              <button
                onClick={() => onStop('paused')}
                disabled={isStopping}
                className="flex-1 bg-slate-100 text-slate-900 rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
              >
                ⏸ Пауза
              </button>
              <button
                onClick={() => onStop('completed')}
                disabled={isStopping}
                className="flex-[1.5] bg-green-600 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
              >
                ✓ Завершить
              </button>
            </>
          ) : (
            <button
              onClick={onStart}
              disabled={isStarting}
              className="flex-1 bg-zinc-900 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform disabled:bg-zinc-400"
            >
              ▶ Начать работу
            </button>
          )}
        </div>
      )}

      {isPendingApproval && (
        <div className="mt-3 bg-amber-100 rounded-lg px-3 py-2 text-xs font-bold text-amber-700 text-center">
          ⏳ Ожидаем одобрения администратора
        </div>
      )}

      {work.status === 'completed' && !isRunning && !isPendingApproval && (
        <div className="mt-2 text-center py-1 text-green-600 font-black text-xs uppercase">
          ✓ Работа выполнена
        </div>
      )}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    created: { label: 'Новый', color: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'В работе', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'На утверждении', color: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Отменён', color: 'bg-red-100 text-red-700' },
  };
  const { label, color } = labels[status] ?? {
    label: status,
    color: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={cn('text-[10px] font-black uppercase px-3 py-1 rounded-full', color)}>
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [showAddWork, setShowAddWork] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [showExtraWork, setShowExtraWork] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startMutation = useMutation({
    mutationFn: async (workId: string) => {
      const res = await fetch(`/api/mechanic/orders/${id}/work/${workId}/start`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка запуска');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
  });

  const stopMutation = useMutation({
    mutationFn: async ({ workId, status }: { workId: string; status: 'paused' | 'completed' }) => {
      const res = await fetch(`/api/mechanic/orders/${id}/work/${workId}/stop`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Ошибка остановки');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Ошибка ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setAcceptError('');
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
    },
    onError: (e: Error) => setAcceptError(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Ошибка завершения');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['mechanic-orders'] });
      router.push('/mechanic/orders');
    },
  });

  if (isLoading) return <div className="p-4 animate-pulse text-sm text-slate-400">Загрузка...</div>;
  if (!order) return <div className="p-4 text-sm text-red-500">Наряд не найден</div>;

  const activeWorks = order.works.filter(
    (w) => w.status !== 'cancelled' && w.extra_work_status !== 'rejected',
  );
  const hasPendingExtraWork = order.works.some((w) => w.extra_work_status === 'pending_approval');
  const allWorksComplete =
    activeWorks.length > 0 &&
    activeWorks.every(
      (w) => w.status === 'completed' || w.extra_work_status === 'pending_approval',
    );
  const canComplete = allWorksComplete && !hasPendingExtraWork && order.status === 'in_progress';
  const needsAccept = order.status === 'created';
  const inProgress = order.status === 'in_progress';
  const isApproved = order.lifecycle_status === 'approved' && order.status === 'completed';

  return (
    <>
      <div className="space-y-4 pb-28">
        {/* Шапка */}
        <div className="bg-white p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl font-black text-slate-900">Наряд #{order.order_number}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-lg font-bold text-slate-700">
            {order.machine_type === 'own' ? order.asset?.short_name : order.client_vehicle_brand}
          </p>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            {order.machine_type === 'own' ? order.asset?.reg_number : order.client_vehicle_reg}
          </p>
        </div>

        {/* Баннер утверждён */}
        {isApproved && (
          <section className="px-4">
            <div className="bg-green-600 text-white rounded-2xl p-4 text-center">
              <p className="text-lg font-black">✓ Наряд утверждён</p>
              <p className="text-sm opacity-80 mt-1">ЗП начислена</p>
            </div>
          </section>
        )}

        {/* Баннер: нужно принять */}
        {needsAccept && (
          <section className="px-4">
            <div className="bg-zinc-900 text-white rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                Новый наряд — требует подтверждения
              </p>
              <p className="text-sm font-medium leading-relaxed text-zinc-200">
                Ознакомьтесь с описанием и нажмите{' '}
                <strong className="text-white">«Принять в работу»</strong> внизу экрана
              </p>
            </div>
          </section>
        )}

        {/* Заметка администратора */}
        {order.admin_note && (
          <section className="px-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">
                Заметка администратора:
              </p>
              <p className="text-sm text-blue-800 font-medium">{order.admin_note}</p>
            </div>
          </section>
        )}

        {/* Описание проблемы */}
        <section className="px-4">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">
              Задача:
            </p>
            <p className="text-sm text-orange-900 font-medium leading-relaxed">
              {order.problem_description || 'Описание отсутствует'}
            </p>
          </div>
        </section>

        {/* Работы */}
        <section className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Работы ({activeWorks.length})
            </h2>
            <div className="flex gap-2">
              {inProgress && (
                <button
                  onClick={() => setShowExtraWork(true)}
                  className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
                >
                  ⚡ Доп. работа
                </button>
              )}
              {order.status !== 'completed' && (
                <button
                  onClick={() => setShowAddWork(true)}
                  className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
                >
                  + Добавить
                </button>
              )}
            </div>
          </div>

          {order.works.length === 0 && !inProgress && (
            <p className="text-center text-xs text-slate-400 font-bold italic py-4">
              Работы не добавлены
            </p>
          )}
          {inProgress && order.works.length === 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-black text-blue-600 uppercase tracking-wide mb-1">
                Что делать дальше
              </p>
              <p className="text-sm text-blue-800">
                Нажмите <strong>«+ Добавить»</strong> и выберите работу из каталога
              </p>
            </div>
          )}

          {order.works.map((work) => (
            <WorkCard
              key={work.id}
              work={work}
              now={now}
              onStart={() => startMutation.mutate(work.id)}
              onStop={(status) => stopMutation.mutate({ workId: work.id, status })}
              isStarting={startMutation.isPending}
              isStopping={stopMutation.isPending}
            />
          ))}
        </section>

        {/* Запчасти */}
        <section className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Запчасти ({order.parts.length})
            </h2>
            {order.status !== 'completed' && (
              <button
                onClick={() => setShowAddPart(true)}
                className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform"
              >
                + Списать
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {order.parts.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400 font-bold italic">
                Запчасти не списаны
              </p>
            ) : (
              order.parts.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">{p.part.name}</span>
                  <span className="text-sm font-black text-slate-900">
                    {p.quantity} {p.part.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Фиксированная кнопка снизу */}
      {(needsAccept || canComplete) && (
        <div className="fixed bottom-0 left-0 right-0 z-[55] bg-white border-t border-slate-200 shadow-lg px-4 pt-3 pb-6">
          {acceptError && (
            <p className="text-xs text-red-500 font-bold text-center mb-2">Ошибка: {acceptError}</p>
          )}
          {needsAccept ? (
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full bg-zinc-900 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:bg-zinc-400"
            >
              {acceptMutation.isPending ? 'Принимаем...' : '▶ Принять в работу'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (window.confirm('Закрыть наряд и отправить на утверждение?')) {
                  completeMutation.mutate();
                }
              }}
              disabled={completeMutation.isPending}
              className="w-full bg-green-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:bg-green-400"
            >
              {completeMutation.isPending ? 'Закрываем...' : '✓ Закрыть наряд'}
            </button>
          )}
        </div>
      )}

      {hasPendingExtraWork && inProgress && (
        <div className="fixed bottom-0 left-0 right-0 z-[55] bg-amber-50 border-t border-amber-200 px-4 pt-3 pb-6">
          <div className="text-center">
            <p className="text-xs font-black text-amber-700 uppercase">
              ⏳ Ожидаем одобрения доп. работы
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              Наряд нельзя закрыть до ответа администратора
            </p>
          </div>
        </div>
      )}

      <AddWorkModal open={showAddWork} onClose={() => setShowAddWork(false)} orderId={id} />
      <AddPartModal open={showAddPart} onClose={() => setShowAddPart(false)} orderId={id} />
      <ExtraWorkModal open={showExtraWork} onClose={() => setShowExtraWork(false)} orderId={id} />
    </>
  );
}
