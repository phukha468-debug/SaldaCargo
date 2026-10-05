'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Money } from '@saldacargo/ui';
import { formatPhone } from '@saldacargo/shared';

// ── Types ──────────────────────────────────────────────────────────────────

export type Counterparty = {
  id: string;
  name: string;
  type: 'client' | 'supplier' | 'both';
  phone: string | null;
  email: string | null;
  notes: string | null;
  credit_limit: string | null;
  payable_amount: string; // Наш долг поставщику
  receivable_amount: string; // Долг клиента перед нами
  net_balance: string; // Сальдо (положительное = нам должны, отрицательное = мы должны)
  is_active: boolean;
  is_regular: boolean;
  is_legal_entity: boolean;
  supplier_category: string | null;
  total_revenue: string;
  revenue_30d: string;
  net_profit: string;
  margin_pct: number;
  overhead_pct: number;
  trips_count: number;
  orders_count: number;
  avg_order: string;
  last_trip_at: string | null;
  preferred_payment: string | null;
  payment_breakdown: Record<string, number>;
  monthly: string[];
  month_labels: string[];
};

export type TripRecord = {
  id: string;
  trip_id: string | null;
  trip_number: number | null;
  started_at: string | null;
  driver_name: string | null;
  asset_name: string | null;
  amount: string;
  driver_pay: string;
  loader_pay: string;
  fuel_allocated: string;
  gross_profit: string;
  payment_method: string;
  settlement_status: string;
  description?: string;
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Наличные',
  qr: 'QR-код',
  card_driver: 'Карта вод.',
  debt_cash: 'Долг нал',
  bank_invoice: 'Безналичный',
  fuel_card: 'Топливная карта',
};

const emptyForm = {
  name: '',
  type: 'client' as 'client' | 'supplier' | 'both',
  phone: '',
  email: '',
  credit_limit: '',
  payable_amount: '',
  notes: '',
  is_legal_entity: false,
  is_regular: false,
};

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function lastActivityLabel(days: number | null) {
  if (days === null) return 'нет операций';
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function CounterpartiesPage() {
  const qc = useQueryClient();

  // Filters & State
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<
    'all' | 'client' | 'supplier' | 'debtors' | 'creditors' | 'sleeping'
  >('all');
  const [legalFilter, setLegalFilter] = useState<'all' | 'legal' | 'individual'>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Selection & Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'finance' | 'history' | 'requisites' | 'crm'>(
    'finance',
  );

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // Quick Pay Modal (Погашение долга поставщику)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payWallet, setPayWallet] = useState<
    '10000000-0000-0000-0000-000000000001' | '10000000-0000-0000-0000-000000000002'
  >('10000000-0000-0000-0000-000000000001');
  const [payDescription, setPayDescription] = useState('');
  const [payPending, setPayPending] = useState(false);

  // Merge & Duplicates State
  const [showDuplicatesWizard, setShowDuplicatesWizard] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceCp, setMergeSourceCp] = useState<Counterparty | null>(null);
  const [mergeTargetCp, setMergeTargetCp] = useState<Counterparty | null>(null);
  const [mergeSearch, setMergeSearch] = useState('');

  // Sorting
  const [sortCol, setSortCol] = useState<
    'name' | 'revenue' | 'profit' | 'debt' | 'trips' | 'activity'
  >('debt');
  const [sortAsc, setSortAsc] = useState(false);

  // Queries
  const { data: counterparties = [], isLoading } = useQuery<Counterparty[]>({
    queryKey: ['counterparties'],
    queryFn: () => fetch('/api/counterparties').then((r) => r.json()),
    staleTime: 60 * 1000,
  });

  const selectedCp = useMemo(() => {
    return counterparties.find((c) => c.id === selectedId) || null;
  }, [counterparties, selectedId]);

  const { data: history = [], isLoading: historyLoading } = useQuery<TripRecord[]>({
    queryKey: ['counterparty-history', selectedId],
    queryFn: () => fetch(`/api/counterparties/${selectedId!}/trips`).then((r) => r.json()),
    enabled: Boolean(selectedId && drawerOpen),
    staleTime: 60 * 1000,
  });

  // KPI Calculations
  const metrics = useMemo(() => {
    let clientsCount = 0;
    let suppliersCount = 0;
    let legalCount = 0;
    let indCount = 0;
    let rev30d = 0;
    let netProfit30d = 0;
    let totalClientDebt = 0; // дебиторка
    let totalSupplierDebt = 0; // кредиторка
    let debtorsCount = 0;
    let creditorsCount = 0;

    for (const cp of counterparties) {
      if (!cp.is_active && !showInactive) continue;

      if (cp.type === 'client') clientsCount++;
      else if (cp.type === 'supplier') suppliersCount++;
      else {
        clientsCount++;
        suppliersCount++;
      }

      if (cp.is_legal_entity) legalCount++;
      else indCount++;

      rev30d += parseFloat(cp.revenue_30d || '0');
      netProfit30d += parseFloat(cp.net_profit || '0');

      const rec = parseFloat(cp.receivable_amount || '0');
      const pay = parseFloat(cp.payable_amount || '0');

      if (rec > 0) {
        totalClientDebt += rec;
        debtorsCount++;
      }
      if (pay > 0) {
        totalSupplierDebt += pay;
        creditorsCount++;
      }
    }

    return {
      total: counterparties.length,
      clientsCount,
      suppliersCount,
      legalCount,
      indCount,
      rev30d,
      netProfit30d,
      totalClientDebt,
      debtorsCount,
      totalSupplierDebt,
      creditorsCount,
    };
  }, [counterparties, showInactive]);

  // Filtering & Sorting
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = counterparties.filter((cp) => {
      if (!showInactive && !cp.is_active) return false;

      // Text Search
      if (q) {
        const matchesName = cp.name.toLowerCase().includes(q);
        const matchesPhone = (cp.phone ?? '').includes(q);
        const matchesEmail = (cp.email ?? '').toLowerCase().includes(q);
        const matchesNotes = (cp.notes ?? '').toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail && !matchesNotes) return false;
      }

      // Legal filter
      if (legalFilter === 'legal' && !cp.is_legal_entity) return false;
      if (legalFilter === 'individual' && cp.is_legal_entity) return false;

      // Segment filter
      if (segment === 'client' && cp.type === 'supplier') return false;
      if (segment === 'supplier' && cp.type === 'client') return false;
      if (segment === 'debtors' && parseFloat(cp.receivable_amount) <= 0) return false;
      if (segment === 'creditors' && parseFloat(cp.payable_amount) <= 0) return false;
      if (segment === 'sleeping') {
        const days = daysAgo(cp.last_trip_at);
        if (days === null || days <= 30) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      if (sortCol === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortCol === 'revenue') {
        valA = parseFloat(a.total_revenue || '0');
        valB = parseFloat(b.total_revenue || '0');
      } else if (sortCol === 'profit') {
        valA = parseFloat(a.net_profit || '0');
        valB = parseFloat(b.net_profit || '0');
      } else if (sortCol === 'trips') {
        valA = a.trips_count;
        valB = b.trips_count;
      } else if (sortCol === 'debt') {
        valA = Math.abs(parseFloat(a.net_balance || '0'));
        valB = Math.abs(parseFloat(b.net_balance || '0'));
      } else if (sortCol === 'activity') {
        valA = a.last_trip_at ? new Date(a.last_trip_at).getTime() : 0;
        valB = b.last_trip_at ? new Date(b.last_trip_at).getTime() : 0;
      }

      if (sortAsc) return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    return list;
  }, [counterparties, search, segment, legalFilter, showInactive, sortCol, sortAsc]);

  // Детектор дублей (поиск схожих контрагентов по названиям и телефонам)
  const detectedDuplicates = useMemo(() => {
    const clean = (str: string) =>
      str
        .toLowerCase()
        .replace(/\b(ооо|ип|ао|зао|пао|оао|самозанятый|сз|llc)\b/gi, '')
        .replace(/[«»"'`\s.,\-_()]/g, '')
        .trim();

    const cleanPhone = (p: string | null) => {
      if (!p) return '';
      const d = p.replace(/\D/g, '');
      return d.length >= 10 ? d.slice(-10) : '';
    };

    const activeList = counterparties.filter((c) => c.is_active);
    const pairs: Array<{
      id: string;
      reason: string;
      target: Counterparty;
      source: Counterparty;
    }> = [];

    const seenPairs = new Set<string>();

    for (let i = 0; i < activeList.length; i++) {
      for (let j = i + 1; j < activeList.length; j++) {
        const a = activeList[i]!;
        const b = activeList[j]!;

        const aClean = clean(a.name);
        const bClean = clean(b.name);
        const aPhone = cleanPhone(a.phone);
        const bPhone = cleanPhone(b.phone);

        let reason = '';
        if (aClean.length >= 3 && aClean === bClean) {
          reason = 'Одинаковое название';
        } else if (aPhone && bPhone && aPhone === bPhone) {
          reason = `Одинаковый номер телефона (${formatPhone(a.phone)})`;
        } else if (
          aClean.length >= 5 &&
          bClean.length >= 5 &&
          (aClean.includes(bClean) || bClean.includes(aClean))
        ) {
          reason = 'Похожее название (вхождение)';
        }

        if (reason) {
          const pairKey = [a.id, b.id].sort().join(':');
          if (!seenPairs.has(pairKey)) {
            seenPairs.add(pairKey);
            // Кто имеет больше рейсов или больше оборот, тот по умолчанию target
            const aScore = a.trips_count * 10 + (parseFloat(a.total_revenue) > 0 ? 5 : 0);
            const bScore = b.trips_count * 10 + (parseFloat(b.total_revenue) > 0 ? 5 : 0);

            const target = aScore >= bScore ? a : b;
            const source = aScore >= bScore ? b : a;

            pairs.push({
              id: pairKey,
              reason,
              target,
              source,
            });
          }
        }
      }
    }

    return pairs;
  }, [counterparties]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (body: typeof emptyForm) => {
      const url = editId ? `/api/counterparties/${editId}` : '/api/counterparties';
      return fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Ошибка');
        return json;
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      setShowModal(false);
      setEditId(null);
      setForm(emptyForm);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      const res = await fetch('/api/counterparties/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Ошибка объединения контрагентов');
      }
      return res.json();
    },
    onSuccess: (resData) => {
      qc.invalidateQueries({ queryKey: ['counterparties'] });
      qc.invalidateQueries({ queryKey: ['counterparty-history'] });
      setShowMergeModal(false);
      setShowDuplicatesWizard(false);
      setDrawerOpen(false);
      alert(resData.message || 'Контрагенты успешно объединены!');
    },
    onError: (e: Error) => alert(e.message),
  });

  const handleOpenMerge = (cp: Counterparty) => {
    setMergeSourceCp(cp);
    setMergeTargetCp(null);
    setMergeSearch('');
    setShowMergeModal(true);
  };

  const toggleLegal = (cp: Counterparty) => {
    fetch(`/api/counterparties/${cp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_legal_entity: !cp.is_legal_entity }),
    }).then(() => qc.invalidateQueries({ queryKey: ['counterparties'] }));
  };

  const toggleRegular = (cp: Counterparty) => {
    fetch(`/api/counterparties/${cp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_regular: !cp.is_regular }),
    }).then(() => qc.invalidateQueries({ queryKey: ['counterparties'] }));
  };

  const handlePaySupplier = async () => {
    if (!selectedCp || !payAmount || parseFloat(payAmount) <= 0) return;
    setPayPending(true);
    try {
      const res = await fetch(`/api/counterparties/${selectedCp.id}/pay-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          wallet_id: payWallet,
          description: payDescription || `Оплата поставщику ${selectedCp.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка выплаты');

      qc.invalidateQueries({ queryKey: ['counterparties'] });
      qc.invalidateQueries({ queryKey: ['wallets'] });
      qc.invalidateQueries({ queryKey: ['counterparty-history', selectedCp.id] });
      setShowPayModal(false);
      setPayAmount('');
      setPayDescription('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка выплаты');
    } finally {
      setPayPending(false);
    }
  };

  const handleOpenRow = (cp: Counterparty) => {
    setSelectedId(cp.id);
    setDrawerOpen(true);
  };

  const handleEdit = (cp: Counterparty) => {
    setEditId(cp.id);
    setForm({
      name: cp.name,
      type: cp.type,
      phone: cp.phone ?? '',
      email: cp.email ?? '',
      credit_limit: cp.credit_limit ?? '',
      payable_amount: cp.payable_amount ?? '',
      notes: cp.notes ?? '',
      is_legal_entity: cp.is_legal_entity,
      is_regular: cp.is_regular,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleToggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4 max-w-[1720px] mx-auto animate-in fade-in duration-300">
      {/* ── 5 Верхних KPI Карточек ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-400 font-medium">Всего в реестре</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.clientsCount} кл. · {metrics.suppliersCount} пост. · {metrics.legalCount} ЮЛ
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-400 font-medium">Оборот за 30 дней</div>
          <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
            {metrics.rev30d > 0 ? <Money amount={metrics.rev30d.toFixed(2)} /> : '—'}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">
            Активные рейсы клиентов
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-400 font-medium">Чистая прибыль (30д)</div>
          <div className="text-xl font-black text-emerald-700 mt-0.5 font-mono">
            {metrics.netProfit30d !== 0 ? <Money amount={metrics.netProfit30d.toFixed(2)} /> : '—'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">После вычета ЗП, ГСМ и накладных</div>
        </div>

        <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200 shadow-2xs">
          <div className="text-[11px] text-rose-700 font-bold">Дебиторка (Клиенты нам)</div>
          <div className="text-xl font-black text-rose-700 mt-0.5 font-mono">
            {metrics.totalClientDebt > 0 ? (
              <Money amount={metrics.totalClientDebt.toFixed(2)} />
            ) : (
              '0 ₽'
            )}
          </div>
          <div className="text-[10px] text-rose-600 font-semibold mt-1">
            {metrics.debtorsCount} должников
          </div>
        </div>

        <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <div className="text-[11px] text-amber-800 font-bold">Кредиторка (Мы поставщикам)</div>
          <div className="text-xl font-black text-amber-800 mt-0.5 font-mono">
            {metrics.totalSupplierDebt > 0 ? (
              <Money amount={metrics.totalSupplierDebt.toFixed(2)} />
            ) : (
              '0 ₽'
            )}
          </div>
          <div className="text-[10px] text-amber-700 font-semibold mt-1">
            ГСМ, запчасти, сервисы ({metrics.creditorsCount})
          </div>
        </div>
      </div>

      {/* ── Баннер обнаруженных дублей ── */}
      {detectedDuplicates.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 font-black flex items-center justify-center shrink-0">
              ⚡
            </span>
            <div>
              <div className="font-bold text-amber-950 text-sm">
                Обнаружено {detectedDuplicates.length} потенциальных дублей
              </div>
              <div className="text-[11px] text-amber-800">
                Контрагенты с одинаковыми номерами или похожими названиями (например, «
                {detectedDuplicates[0]?.source.name}» и «{detectedDuplicates[0]?.target.name}»)
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDuplicatesWizard(true)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">call_merge</span>
            Мастер объединения дублей ({detectedDuplicates.length})
          </button>
        </div>
      )}

      {/* ── Панель Управления и Фильтров (Operations Bar) ── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Поиск */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: имя, телефон, email, заметки..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <span className="material-symbols-outlined text-[16px] text-slate-400 absolute left-2.5 top-2">
              search
            </span>
          </div>

          {/* Быстрые сегменты */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSegment('all')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Все ({metrics.total})
            </button>
            <button
              onClick={() => setSegment('client')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'client' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Клиенты ({metrics.clientsCount})
            </button>
            <button
              onClick={() => setSegment('supplier')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'supplier' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Поставщики ({metrics.suppliersCount})
            </button>
            <button
              onClick={() => setSegment('debtors')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'debtors' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-600 hover:bg-rose-100'}`}
            >
              Должники ({metrics.debtorsCount})
            </button>
            <button
              onClick={() => setSegment('creditors')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'creditors' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-100'}`}
            >
              Мы должны ({metrics.creditorsCount})
            </button>
            <button
              onClick={() => setSegment('sleeping')}
              className={`px-3 py-1 rounded-lg transition-all ${segment === 'sleeping' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Спящие &gt;30д
            </button>
          </div>

          {/* Правовая форма */}
          <select
            value={legalFilter}
            onChange={(e) => setLegalFilter(e.target.value as 'all' | 'legal' | 'individual')}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">Форма: Все</option>
            <option value="legal">Юрлица (ООО / АО)</option>
            <option value="individual">Физлица / ИП</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={() => setShowInactive(!showInactive)}
              className="accent-slate-800 rounded"
            />
            Архив
          </label>
        </div>

        {/* Действия */}
        <div className="flex items-center gap-2">
          {detectedDuplicates.length > 0 && (
            <button
              onClick={() => setShowDuplicatesWizard(true)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              title="Открыть мастер слияния дублей"
            >
              <span className="material-symbols-outlined text-[16px]">call_merge</span>
              Дубли ({detectedDuplicates.length})
            </button>
          )}

          <button
            onClick={() => {
              setEditId(null);
              setForm(emptyForm);
              setFormError('');
              setShowModal(true);
            }}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Добавить контрагента
          </button>
        </div>
      </div>

      {/* ── B2B Operations Grid (Таблица Реестра) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th
                  className="py-3 px-3.5 cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('name')}
                >
                  Контрагент ⇕
                </th>
                <th className="py-3 px-3">Тип / Роль</th>
                <th className="py-3 px-3">Контакты</th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('revenue')}
                >
                  Выручка / Оборот ⇕
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('profit')}
                >
                  Чист. прибыль ⇕
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('trips')}
                >
                  Рейсов ⇕
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('debt')}
                >
                  Сальдо / Долг ⇕
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-slate-900"
                  onClick={() => handleToggleSort('activity')}
                >
                  Активность ⇕
                </th>
                <th className="py-3 px-3 text-center w-24">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-slate-800 mb-2"></div>
                    <div>Загрузка контрагентов...</div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Не найдено контрагентов по заданным фильтрам
                  </td>
                </tr>
              ) : (
                filteredList.map((cp) => {
                  const days = daysAgo(cp.last_trip_at);
                  const recDebt = parseFloat(cp.receivable_amount || '0');
                  const payDebt = parseFloat(cp.payable_amount || '0');

                  const isSupplier = cp.type === 'supplier';
                  const isBoth = cp.type === 'both';

                  return (
                    <tr
                      key={cp.id}
                      onClick={() => handleOpenRow(cp)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${selectedId === cp.id && drawerOpen ? 'bg-blue-50/80 font-medium' : ''} ${!cp.is_active ? 'opacity-40' : ''}`}
                    >
                      {/* Контрагент */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold text-slate-900 text-xs truncate max-w-[220px]"
                            title={cp.name}
                          >
                            {cp.name}
                          </span>
                          {cp.is_legal_entity ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLegal(cp);
                              }}
                              className="shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                              title="Юрлицо (кликните для смены)"
                            >
                              ЮЛ
                            </span>
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLegal(cp);
                              }}
                              className="shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
                              title="Физлицо (кликните для смены)"
                            >
                              ФЛ
                            </span>
                          )}
                        </div>
                        {cp.notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[220px] mt-0.5">
                            {cp.notes}
                          </div>
                        )}
                      </td>

                      {/* Тип / Роль */}
                      <td className="py-2.5 px-3">
                        {isSupplier ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            <span>⛽</span> {cp.supplier_category || 'Поставщик'}
                          </span>
                        ) : isBoth ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                            Клиент + Пост.
                          </span>
                        ) : cp.is_regular ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRegular(cp);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                            title="Постоянный клиент"
                          >
                            ★ Постоянный
                          </span>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRegular(cp);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                            title="Разовый клиент"
                          >
                            Разовый
                          </span>
                        )}
                      </td>

                      {/* Контакты */}
                      <td className="py-2.5 px-3">
                        {cp.phone ? (
                          <a
                            href={`tel:${cp.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-700 hover:text-blue-600 font-mono text-[11px] block"
                          >
                            {formatPhone(cp.phone)}
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                        {cp.email && (
                          <span
                            className="text-[10px] text-slate-400 truncate block max-w-[130px]"
                            title={cp.email}
                          >
                            {cp.email}
                          </span>
                        )}
                      </td>

                      {/* Выручка */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {parseFloat(cp.total_revenue) > 0 ? (
                          <Money amount={cp.total_revenue} />
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>

                      {/* Чистая прибыль */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {parseFloat(cp.total_revenue) > 0 ? (
                          <div>
                            <span
                              className={`font-bold ${parseFloat(cp.net_profit) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                            >
                              <Money amount={cp.net_profit} />
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {cp.margin_pct}% маржа
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Рейсов */}
                      <td className="py-2.5 px-3 text-right">
                        {cp.trips_count > 0 ? (
                          <span className="font-bold text-slate-800">{cp.trips_count}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Сальдо / Долг */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {recDebt > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">
                            нам: <Money amount={recDebt.toFixed(2)} />
                          </span>
                        ) : payDebt > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                            наш долг: <Money amount={payDebt.toFixed(2)} />
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">0 ₽</span>
                        )}
                      </td>

                      {/* Активность */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[11px] font-medium ${days !== null && days > 30 ? 'text-amber-600' : 'text-slate-600'}`}
                        >
                          {lastActivityLabel(days)}
                        </span>
                      </td>

                      {/* Действия */}
                      <td className="py-2.5 px-3 text-center">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleOpenRow(cp)}
                            className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                            title="Открыть досье"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              visibility
                            </span>
                          </button>
                          <button
                            onClick={() => handleEdit(cp)}
                            className="p-1 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                            title="Редактировать"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => handleOpenMerge(cp)}
                            className="p-1 hover:bg-amber-100 text-amber-700 rounded-lg transition"
                            title="Объединить дубль с другим контрагентом"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              call_merge
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Футер таблицы */}
        <div className="p-3 bg-slate-50/60 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <span>
            Показано: <strong className="text-slate-800">{filteredList.length}</strong> контрагентов
          </span>
          <span className="text-slate-400">
            Кликните по любой строке для быстрого открытия досье
          </span>
        </div>
      </div>

      {/* ── Slide-over Drawer (Инспектор Контрагента на 650px) ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
          />

          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
              {/* Шапка Досье */}
              {selectedCp && (
                <>
                  <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between">
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white font-bold text-lg flex items-center justify-center shrink-0 shadow-xs">
                        {selectedCp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-slate-900 leading-snug">
                            {selectedCp.name}
                          </h2>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${selectedCp.is_legal_entity ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {selectedCp.is_legal_entity ? 'ЮРЛИЦО' : 'ФИЗЛИЦО'}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${selectedCp.type === 'supplier' ? 'bg-purple-100 text-purple-800' : selectedCp.is_regular ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                          >
                            {selectedCp.type === 'supplier'
                              ? 'ПОСТАВЩИК'
                              : selectedCp.is_regular
                                ? 'ПОСТОЯННЫЙ'
                                : 'РАЗОВЫЙ'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          {selectedCp.phone && (
                            <a
                              href={`tel:${selectedCp.phone}`}
                              className="hover:text-blue-600 font-mono"
                            >
                              {formatPhone(selectedCp.phone)}
                            </a>
                          )}
                          {selectedCp.email && <span>{selectedCp.email}</span>}
                          <span>
                            Последний рейс:{' '}
                            <strong>{lastActivityLabel(daysAgo(selectedCp.last_trip_at))}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  {/* Быстрые Кнопки Действий */}
                  <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {selectedCp.type === 'supplier' ? (
                        <button
                          onClick={() => {
                            setPayAmount(selectedCp.payable_amount || '');
                            setShowPayModal(true);
                          }}
                          className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">payments</span>
                          Погасить долг поставщику
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            alert(`Создание нового рейса с заказчиком «${selectedCp.name}»`)
                          }
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            local_shipping
                          </span>
                          Создать рейс
                        </button>
                      )}

                      <button
                        onClick={() => handleEdit(selectedCp)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                      >
                        Редактировать
                      </button>

                      <button
                        onClick={() => handleOpenMerge(selectedCp)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                        title="Объединить с другим контрагентом (слияние дублей)"
                      >
                        <span className="material-symbols-outlined text-[16px]">call_merge</span>
                        Объединить дубль
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {selectedCp.phone && (
                        <a
                          href={`https://wa.me/${selectedCp.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition"
                          title="Открыть диалог в WhatsApp"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Вкладки Досье */}
                  <div className="border-b border-slate-200 px-5 flex gap-6 text-xs bg-white font-semibold">
                    <button
                      onClick={() => setDrawerTab('finance')}
                      className={`py-3 transition-colors ${drawerTab === 'finance' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Финансы и Взаиморасчеты
                    </button>
                    <button
                      onClick={() => setDrawerTab('history')}
                      className={`py-3 transition-colors ${drawerTab === 'history' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {selectedCp.type === 'supplier' ? 'Поставки и Заправки' : 'История рейсов'} (
                      {history.length})
                    </button>
                    <button
                      onClick={() => setDrawerTab('requisites')}
                      className={`py-3 transition-colors ${drawerTab === 'requisites' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Реквизиты и Договор
                    </button>
                    <button
                      onClick={() => setDrawerTab('crm')}
                      className={`py-3 transition-colors ${drawerTab === 'crm' ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Заметки и CRM
                    </button>
                  </div>

                  {/* Тело Досье */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Таб 1: Финансы и Сальдо */}
                    {drawerTab === 'finance' && (
                      <div className="space-y-4">
                        {/* 4 KPI плитки */}
                        <div className="grid grid-cols-4 gap-2.5">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-medium">
                              Выручка за всё время
                            </div>
                            <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">
                              {parseFloat(selectedCp.total_revenue) > 0 ? (
                                <Money amount={selectedCp.total_revenue} />
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>

                          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                            <div className="text-[10px] text-emerald-600 font-medium">
                              Чистая прибыль
                            </div>
                            <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">
                              {parseFloat(selectedCp.total_revenue) > 0 ? (
                                <Money amount={selectedCp.net_profit} />
                              ) : (
                                '—'
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-[10px] text-slate-400 font-medium">
                              Всего рейсов
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {selectedCp.trips_count}
                            </div>
                          </div>

                          <div
                            className={`p-3 rounded-xl border ${parseFloat(selectedCp.receivable_amount) > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : parseFloat(selectedCp.payable_amount) > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                          >
                            <div className="text-[10px] font-medium">
                              {parseFloat(selectedCp.receivable_amount) > 0
                                ? 'Дебиторка (долг нам)'
                                : parseFloat(selectedCp.payable_amount) > 0
                                  ? 'Кредиторка (наш долг)'
                                  : 'Текущее сальдо'}
                            </div>
                            <div className="text-sm font-bold font-mono mt-0.5">
                              {parseFloat(selectedCp.receivable_amount) > 0 ? (
                                <Money amount={selectedCp.receivable_amount} />
                              ) : parseFloat(selectedCp.payable_amount) > 0 ? (
                                <Money amount={selectedCp.payable_amount} />
                              ) : (
                                '0 ₽'
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Плашка взаиморасчетов */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800">
                              Состояние взаиморасчетов:
                            </span>
                            {parseFloat(selectedCp.payable_amount) > 0 ? (
                              <button
                                onClick={() => {
                                  setPayAmount(selectedCp.payable_amount);
                                  setShowPayModal(true);
                                }}
                                className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition"
                              >
                                Выплатить{' '}
                                {parseFloat(selectedCp.payable_amount).toLocaleString('ru-RU')} ₽
                              </button>
                            ) : parseFloat(selectedCp.receivable_amount) > 0 ? (
                              <span className="font-bold text-rose-600 font-mono">
                                Клиент должен: <Money amount={selectedCp.receivable_amount} />
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">
                                Все расчеты закрыты (0 ₽)
                              </span>
                            )}
                          </div>

                          {selectedCp.credit_limit && parseFloat(selectedCp.credit_limit) > 0 && (
                            <div className="pt-2 border-t border-slate-200 flex justify-between text-slate-500">
                              <span>Кредитный лимит:</span>
                              <span className="font-bold text-slate-800 font-mono">
                                <Money amount={selectedCp.credit_limit} />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* График по месяцам */}
                        {selectedCp.monthly &&
                          selectedCp.monthly.some((v) => parseFloat(v) > 0) && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                                Динамика выручки по месяцам
                              </div>
                              <div className="flex items-end gap-2 h-20">
                                {selectedCp.monthly.map((v, i) => {
                                  const num = parseFloat(v);
                                  const max = Math.max(
                                    ...selectedCp.monthly.map((x) => parseFloat(x)),
                                    1,
                                  );
                                  const h = num > 0 ? Math.max(Math.round((num / max) * 64), 4) : 0;
                                  return (
                                    <div
                                      key={i}
                                      className="flex-1 flex flex-col items-center gap-1"
                                    >
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {num > 0 ? Math.round(num / 1000) + 'к' : ''}
                                      </div>
                                      <div
                                        className="w-full bg-slate-800 rounded-t"
                                        style={{
                                          height: `${h}px`,
                                          minHeight: num > 0 ? '4px' : '0',
                                        }}
                                      />
                                      <div className="text-[10px] text-slate-400">
                                        {selectedCp.month_labels[i]}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Таб 2: История рейсов / Заказов / Поставок */}
                    {drawerTab === 'history' && (
                      <div>
                        {historyLoading ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            Загрузка истории...
                          </div>
                        ) : history.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-xs">
                            Нет зарегистрированных рейсов или поставок
                          </div>
                        ) : (
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px]">
                                <tr>
                                  <th className="p-2.5">Дата / Рейс</th>
                                  <th className="p-2.5">Водитель / Машина</th>
                                  <th className="p-2.5 text-right">Сумма</th>
                                  <th className="p-2.5 text-right">Чистая</th>
                                  <th className="p-2.5 text-center">Оплата</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-[11px]">
                                {history.map((t) => (
                                  <tr key={t.id} className="hover:bg-slate-50">
                                    <td className="p-2.5">
                                      <div className="font-bold text-slate-800">
                                        {t.trip_number ? `#${t.trip_number}` : 'Заказ'}
                                      </div>
                                      <div className="text-[10px] text-slate-400">
                                        {fmtDate(t.started_at)}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-slate-600">
                                      <div>{t.driver_name || '—'}</div>
                                      <div className="text-[10px] text-slate-400">
                                        {t.asset_name || '—'}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right font-bold font-mono text-slate-900">
                                      <Money amount={t.amount} />
                                    </td>
                                    <td className="p-2.5 text-right font-bold font-mono text-emerald-600">
                                      {parseFloat(t.gross_profit) !== 0 ? (
                                        <Money amount={t.gross_profit} />
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${t.settlement_status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}
                                      >
                                        {t.settlement_status === 'completed' ? 'Оплачен' : 'Долг'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Таб 3: Реквизиты и Договор */}
                    {drawerTab === 'requisites' && (
                      <div className="space-y-4 text-xs">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <h4 className="font-bold text-slate-800">Юридический статус</h4>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                              <span className="text-slate-400">Форма:</span>{' '}
                              {selectedCp.is_legal_entity ? 'Юрлицо (ООО/АО)' : 'Физлицо / ИП'}
                            </div>
                            <div>
                              <span className="text-slate-400">Статус клиента:</span>{' '}
                              {selectedCp.is_regular ? 'Постоянный' : 'Разовый'}
                            </div>
                            <div>
                              <span className="text-slate-400">Телефон:</span>{' '}
                              {selectedCp.phone || '—'}
                            </div>
                            <div>
                              <span className="text-slate-400">Email:</span>{' '}
                              {selectedCp.email || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <h4 className="font-bold text-slate-800">Условия сотрудничества</h4>
                          <div className="text-slate-600 space-y-1">
                            <div>
                              Кредитный лимит:{' '}
                              <strong>
                                {selectedCp.credit_limit
                                  ? `${parseFloat(selectedCp.credit_limit).toLocaleString('ru-RU')} ₽`
                                  : 'Без лимита'}
                              </strong>
                            </div>
                            <div>
                              Основной способ оплаты:{' '}
                              <strong>
                                {PAYMENT_LABEL[selectedCp.preferred_payment || ''] || 'Не указан'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Таб 4: Заметки и CRM */}
                    {drawerTab === 'crm' && (
                      <div className="space-y-4 text-xs">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                          <h4 className="font-bold text-slate-800">Заметки диспетчера</h4>
                          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                            {selectedCp.notes ||
                              'Заметок пока нет. Нажмите «Редактировать», чтобы добавить контактных лиц или особенности работы.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка Быстрой Выплаты Долга Поставщику ── */}
      {showPayModal && selectedCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Выплата поставщику</h3>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Поставщик</label>
                <div className="font-bold text-slate-800 text-sm">{selectedCp.name}</div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Сумма выплаты (₽) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-base font-bold font-mono px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Счёт списания *</label>
                <select
                  value={payWallet}
                  onChange={(e) =>
                    setPayWallet(
                      e.target.value as
                        | '10000000-0000-0000-0000-000000000001'
                        | '10000000-0000-0000-0000-000000000002',
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="10000000-0000-0000-0000-000000000001">
                    Расчётный счёт (Т-Банк)
                  </option>
                  <option value="10000000-0000-0000-0000-000000000002">Касса (наличные)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Назначение / Комментарий</label>
                <input
                  type="text"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  placeholder="Оплата по счету / акту..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                onClick={handlePaySupplier}
                disabled={payPending || !payAmount}
                className="flex-1 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50 transition"
              >
                {payPending ? 'Списание...' : 'Подтвердить оплату'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка Создания / Редактирования Контрагента ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">
                {editId ? 'Редактировать контрагента' : 'Новый контрагент'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Название / Имя *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ООО Металлург или Иванов И.И."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Тип контрагента</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as 'client' | 'supplier' | 'both' })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="client">Клиент (заказчик)</option>
                    <option value="supplier">Поставщик (ГСМ/запчасти/услуги)</option>
                    <option value="both">Клиент + Поставщик</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Правовая форма</label>
                  <select
                    value={form.is_legal_entity ? 'legal' : 'individual'}
                    onChange={(e) =>
                      setForm({ ...form, is_legal_entity: e.target.value === 'legal' })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="legal">Юрлицо (ООО / АО)</option>
                    <option value="individual">Физлицо / ИП</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Телефон</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+7 922 000-00-00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="client@domain.ru"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Кредитный лимит (₽)
                  </label>
                  <input
                    type="number"
                    value={form.credit_limit}
                    onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                    placeholder="0 — без лимита"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Наш долг поставщику (₽)
                  </label>
                  <input
                    type="number"
                    value={form.payable_amount}
                    onChange={(e) => setForm({ ...form, payable_amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk_reg"
                  checked={form.is_regular}
                  onChange={(e) => setForm({ ...form, is_regular: e.target.checked })}
                  className="accent-slate-900 rounded"
                />
                <label htmlFor="chk_reg" className="text-slate-700 font-medium cursor-pointer">
                  Постоянный контрагент (регулярные отгрузки)
                </label>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Заметки и особенности
                </label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Контактные лица, логист, отсрочка платежа, требования..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none resize-none"
                />
              </div>

              {formError && (
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="flex-1 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка: Мастер объединения найденных дублей ── */}
      {showDuplicatesWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center">
                  ⚡
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Мастер объединения дублей</h3>
                  <div className="text-[11px] text-slate-500">
                    Найдено {detectedDuplicates.length} совпадений. Все рейсы, транзакции,
                    заказ-наряды и долги будут перенесены.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDuplicatesWizard(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 text-xs flex-1">
              {detectedDuplicates.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-2xl mb-1">✓</div>
                  Все дубли успешно объединены!
                </div>
              ) : (
                detectedDuplicates.map((pair) => (
                  <div
                    key={pair.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:border-amber-300 transition space-y-3"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {pair.reason}
                      </span>
                      <span className="text-slate-400">
                        «{pair.source.name}» ➔ «{pair.target.name}»
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Дубль (будет деактивирован) */}
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40">
                        <div className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Дубль (будет скрыт)</span>
                          <span className="material-symbols-outlined text-[14px]">archive</span>
                        </div>
                        <div className="font-bold text-slate-900 text-sm">{pair.source.name}</div>
                        <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                          {pair.source.phone && <div>Тел: {formatPhone(pair.source.phone)}</div>}
                          <div>
                            Рейсов: <strong>{pair.source.trips_count}</strong> · Оборот:{' '}
                            <strong>{pair.source.total_revenue} ₽</strong>
                          </div>
                          {parseFloat(pair.source.receivable_amount) > 0 && (
                            <div className="text-rose-600 font-bold">
                              Долг клиента: {pair.source.receivable_amount} ₽
                            </div>
                          )}
                          {parseFloat(pair.source.payable_amount) > 0 && (
                            <div className="text-amber-700 font-bold">
                              Наш долг: {pair.source.payable_amount} ₽
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Основной (сохранится) */}
                      <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/40">
                        <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Основной (сохранится)</span>
                          <span className="material-symbols-outlined text-[14px]">verified</span>
                        </div>
                        <div className="font-bold text-slate-900 text-sm">{pair.target.name}</div>
                        <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                          {pair.target.phone && <div>Тел: {formatPhone(pair.target.phone)}</div>}
                          <div>
                            Рейсов: <strong>{pair.target.trips_count}</strong> · Оборот:{' '}
                            <strong>{pair.target.total_revenue} ₽</strong>
                          </div>
                          {parseFloat(pair.target.receivable_amount) > 0 && (
                            <div className="text-rose-600 font-bold">
                              Долг клиента: {pair.target.receivable_amount} ₽
                            </div>
                          )}
                          {parseFloat(pair.target.payable_amount) > 0 && (
                            <div className="text-amber-700 font-bold">
                              Наш долг: {pair.target.payable_amount} ₽
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          setMergeSourceCp(pair.target);
                          setMergeTargetCp(pair.source);
                          setShowMergeModal(true);
                          setShowDuplicatesWizard(false);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                      >
                        ⇄ Поменять роли или выбрать другого
                      </button>

                      <button
                        type="button"
                        disabled={mergeMutation.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Объединить дубль «${pair.source.name}» в основного контрагента «${pair.target.name}»? Все рейсы, транзакции и долги перейдут к «${pair.target.name}».`,
                            )
                          ) {
                            mergeMutation.mutate({
                              sourceId: pair.source.id,
                              targetId: pair.target.id,
                            });
                          }
                        }}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition text-xs flex items-center gap-1 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[15px]">call_merge</span>
                        Объединить в «{pair.target.name}»
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                onClick={() => setShowDuplicatesWizard(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модалка: Ручное объединение контрагентов ── */}
      {showMergeModal && mergeSourceCp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-800 text-[22px]">
                  call_merge
                </span>
                <h3 className="font-bold text-base text-slate-900">Объединение контрагентов</h3>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Схема объединения со стрелкой и кнопкой swap */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Схема объединения
                  </span>
                  {mergeTargetCp && (
                    <button
                      type="button"
                      onClick={() => {
                        const temp = mergeSourceCp;
                        setMergeSourceCp(mergeTargetCp);
                        setMergeTargetCp(temp);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <span>⇄</span> Поменять местами
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Дубль */}
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="text-[10px] font-bold text-rose-700 uppercase">
                      Дубль (исчезнет)
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                      {mergeSourceCp.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Рейсов: {mergeSourceCp.trips_count} · Долг: {mergeSourceCp.receivable_amount}{' '}
                      ₽
                    </div>
                  </div>

                  {/* Основной */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">
                      Основной (останется)
                    </div>
                    {mergeTargetCp ? (
                      <>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">
                          {mergeTargetCp.name}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          Рейсов: {mergeTargetCp.trips_count} · Долг:{' '}
                          {mergeTargetCp.receivable_amount} ₽
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-400 italic text-[11px] mt-0.5">
                        Выберите ниже...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Выбор целевого контрагента */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Выберите основного контрагента (в кого объединяем) *
                </label>
                <input
                  type="text"
                  value={mergeSearch}
                  onChange={(e) => setMergeSearch(e.target.value)}
                  placeholder="Поиск по названию или телефону..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs mb-2"
                />

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {counterparties
                    .filter((c) => c.is_active && c.id !== mergeSourceCp.id)
                    .filter((c) => {
                      if (!mergeSearch.trim()) return true;
                      const q = mergeSearch.toLowerCase();
                      return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
                    })
                    .slice(0, 15)
                    .map((c) => {
                      const isSelected = mergeTargetCp?.id === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setMergeTargetCp(c)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-blue-50 font-bold text-blue-900' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          <div>
                            <div className="font-semibold text-xs">{c.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {c.phone ? formatPhone(c.phone) : 'Без тел.'} · {c.trips_count} рейсов
                              · Выручка: {c.total_revenue} ₽
                            </div>
                          </div>
                          {isSelected && <span className="text-blue-600 font-black">✓</span>}
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60">
                ℹ️ <strong>Что произойдет:</strong> Все рейсы, финансовые транзакции, заказ-наряды и
                задолженности будут привязаны к выбранному основному контрагенту. Контрагент-дубль
                будет деактивирован.
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowMergeModal(false)}
                className="flex-1 py-2 text-xs font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition"
              >
                Отмена
              </button>
              <button
                disabled={!mergeTargetCp || mergeMutation.isPending}
                onClick={() => {
                  if (mergeTargetCp) {
                    mergeMutation.mutate({
                      sourceId: mergeSourceCp.id,
                      targetId: mergeTargetCp.id,
                    });
                  }
                }}
                className="flex-1 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl disabled:opacity-50 transition flex items-center justify-center gap-1"
              >
                {mergeMutation.isPending ? 'Объединение...' : 'Объединить данные'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
