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

interface OrderDetail {
  id: string;
  order_number: number;
  status: string;
  machine_type: 'own' | 'client';
  asset?: { short_name: string; reg_number: string };
  client_vehicle_brand?: string;
  client_vehicle_reg?: string;
  problem_description: string;
  works: Array<{
    id: string;
    work_catalog?: { name: string; norm_minutes: number };
    custom_work_name?: string;
    status: string;
    actual_minutes: number;
    time_logs: Array<{ started_at: string; stopped_at: string | null; status: string }>;
  }>;
  parts: Array<{
    id: string;
    part: { name: string; unit: string };
    quantity: number;
  }>;
}

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
        'fixed inset-0 z-50 transition-all duration-300',
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
        {footer && <div className="p-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

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

  const { data: catalog = [] } = useQuery<CatalogItem[]>({
    queryKey: ['work-catalog'],
    queryFn: async () => {
      const r = await fetch('/api/mechanic/catalog');
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
        throw new Error(err.error || 'Ошибка');
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      setSelectedCatalogId(null);
      setCustomName('');
      setCustomNorm('');
      onClose();
    },
  });

  const handleAdd = () => {
    if (tab === 'catalog' && selectedCatalogId) {
      addMutation.mutate({ work_catalog_id: selectedCatalogId });
    } else if (tab === 'custom' && customName.trim()) {
      addMutation.mutate({
        custom_work_name: customName.trim(),
        norm_minutes: customNorm ? Number(customNorm) : 0,
      });
    }
  };

  const addButton = (
    <button
      onClick={handleAdd}
      disabled={
        addMutation.isPending || (tab === 'catalog' ? !selectedCatalogId : !customName.trim())
      }
      className="w-full bg-orange-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-40"
    >
      {addMutation.isPending ? 'Добавляем...' : 'Добавить работу'}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Добавить работу" footer={addButton}>
      <div className="flex gap-2 mb-4">
        {(['catalog', 'custom'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-colors',
              tab === t ? 'bg-zinc-900 text-white' : 'bg-slate-100 text-slate-500',
            )}
          >
            {t === 'catalog' ? 'Из каталога' : 'Своя работа'}
          </button>
        ))}
      </div>

      {tab === 'catalog' ? (
        <div className="space-y-2">
          {catalog.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-4">Каталог пуст</p>
          )}
          {catalog.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedCatalogId(item.id === selectedCatalogId ? null : item.id)}
              className={cn(
                'w-full text-left p-3 rounded-xl border-2 transition-colors',
                selectedCatalogId === item.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-100 bg-white',
              )}
            >
              <p className="text-sm font-bold text-slate-900">{item.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">
                Норма: {item.norm_minutes} мин
              </p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              Название работы *
            </label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Замена масла..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              Норма (мин)
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
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, [search]);

  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: ['parts-search', debouncedSearch],
    queryFn: async () => {
      const r = await fetch(`/api/mechanic/parts?search=${encodeURIComponent(debouncedSearch)}`);
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
      setSearch('');
      setSelectedPart(null);
      setQty('1');
      onClose();
    },
  });

  return (
    <BottomSheet open={open} onClose={onClose} title="Списать запчасть">
      {!selectedPart ? (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или артикулу..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />
          <div className="space-y-2">
            {parts.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part)}
                className="w-full text-left p-3 rounded-xl border border-slate-100 bg-white active:bg-slate-50"
              >
                <div className="flex justify-between items-start">
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
                      'text-xs font-black',
                      part.stock > 0 ? 'text-green-600' : 'text-red-500',
                    )}
                  >
                    {part.stock} {part.unit}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-sm font-black text-orange-900">{selectedPart.name}</p>
            <p className="text-[10px] text-orange-500 font-bold uppercase">
              На складе: {selectedPart.stock} {selectedPart.unit}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
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
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPart(null)}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3 text-xs font-black uppercase"
            >
              Назад
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !qty || Number(qty) <= 0}
              className="flex-[2] bg-orange-600 text-white rounded-xl py-3 text-xs font-black uppercase active:scale-95 transition-transform disabled:opacity-40"
            >
              {addMutation.isPending ? 'Списываем...' : 'Списать'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function WorkCard({
  work,
  now,
  onStart,
  onStop,
  isStarting,
  isStopping,
}: {
  work: OrderDetail['works'][number];
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

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-2 p-4 transition-all relative overflow-hidden',
        isRunning ? 'border-orange-500 shadow-lg shadow-orange-100' : 'border-slate-100',
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <p className="text-sm font-black text-slate-900 leading-tight">{workName}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Норма: {normMins}м · Факт: {totalMinutes}м
          </p>
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

      <div className="flex gap-2">
        {isRunning ? (
          <>
            <button
              onClick={() => onStop('paused')}
              disabled={isStopping}
              className="flex-1 bg-slate-100 text-slate-900 rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Пауза
            </button>
            <button
              onClick={() => onStop('completed')}
              disabled={isStopping}
              className="flex-[1.5] bg-green-600 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Завершить
            </button>
          </>
        ) : work.status !== 'completed' ? (
          <button
            onClick={onStart}
            disabled={isStarting}
            className="flex-1 bg-zinc-900 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            Начать работу
          </button>
        ) : (
          <div className="flex-1 text-center py-2 text-green-600 font-black text-xs uppercase italic opacity-50">
            Работа выполнена
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    created: { label: 'В очереди', color: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'В работе', color: 'bg-orange-100 text-orange-700' },
    completed: { label: 'Готово', color: 'bg-green-100 text-green-700' },
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

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [showAddWork, setShowAddWork] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ['order-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/orders/${id}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
    refetchInterval: 10000,
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
      if (!res.ok) throw new Error('Ошибка');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order-detail', id] }),
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

  const allWorksComplete =
    order.works.length > 0 && order.works.every((w) => w.status === 'completed');
  const canComplete = allWorksComplete && order.status === 'in_progress';
  const needsAccept = order.status === 'created';

  return (
    <>
      <div className="space-y-4 pb-24">
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

        {/* Баннер: наряд ещё не принят */}
        {needsAccept && (
          <section className="px-4">
            <div className="bg-zinc-900 text-white rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Новый наряд
              </p>
              <p className="text-base font-bold leading-snug">
                Ознакомьтесь с задачей и нажмите кнопку ниже, чтобы принять наряд в работу
              </p>
            </div>
          </section>
        )}

        <section className="px-4">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">
              Что болит:
            </p>
            <p className="text-sm text-orange-900 font-medium leading-relaxed">
              {order.problem_description || 'Описание отсутствует'}
            </p>
          </div>
        </section>

        <section className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Работы ({order.works.length})
            </h2>
            {order.status !== 'completed' && (
              <button
                onClick={() => setShowAddWork(true)}
                className="text-[10px] font-black text-orange-600 uppercase tracking-widest"
              >
                + Добавить
              </button>
            )}
          </div>
          {order.works.length === 0 && (
            <p className="text-center text-xs text-slate-400 font-bold italic py-4">
              Работы не добавлены
            </p>
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

        <section className="px-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Запчасти ({order.parts.length})
            </h2>
            {order.status !== 'completed' && (
              <button
                onClick={() => setShowAddPart(true)}
                className="text-[10px] font-black text-orange-600 uppercase tracking-widest"
              >
                + Списать
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {order.parts.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-400 font-bold italic">
                Запчасти ещё не списаны
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

      {(needsAccept || canComplete) && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-lg">
          {needsAccept ? (
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full bg-zinc-900 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-60"
            >
              {acceptMutation.isPending ? 'Принимаем...' : '▶ Принять наряд в работу'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (window.confirm('Завершить наряд? Все работы выполнены.')) {
                  completeMutation.mutate();
                }
              }}
              disabled={completeMutation.isPending}
              className="w-full bg-green-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-60"
            >
              {completeMutation.isPending ? 'Завершаем...' : '✓ Закрыть наряд'}
            </button>
          )}
        </div>
      )}

      <AddWorkModal open={showAddWork} onClose={() => setShowAddWork(false)} orderId={id} />
      <AddPartModal open={showAddPart} onClose={() => setShowAddPart(false)} orderId={id} />
    </>
  );
}
