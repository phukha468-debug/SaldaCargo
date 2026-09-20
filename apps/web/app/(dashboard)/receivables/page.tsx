'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Money } from '@saldacargo/ui';
import { formatDate, formatPhone } from '@saldacargo/shared';

type FollowUp = {
  status: 'active' | 'promised' | 'disputed' | 'bad_debt';
  promise_date: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
  notes: string | null;
  updated_at: string;
};

type Order = {
  id: string;
  type: 'trip_order' | 'manual';
  amount: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  trip_number: number | null;
  started_at: string | null;
  driver_name: string | null;
  asset_name?: string | null;
  asset_reg_number?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  invoice_status?: 'unbilled' | 'issued' | 'paid' | null;
  invoice_paid_at?: string | null;
};

type Debtor = {
  counterparty_id: string;
  counterparty_name: string;
  counterparty_phone: string | null;
  counterparty_email: string | null;
  counterparty_subname: string | null;
  is_individual: boolean;
  is_legal_entity?: boolean;
  total: string;
  oldest_at: string;
  orders: Order[];
  follow_up: FollowUp | null;
};

type ReceivablesData = {
  debtors: Debtor[];
  totalAmount: string;
  overdueCount: number;
};

const WALLET_OPTIONS = [
  { id: '10000000-0000-0000-0000-000000000001', label: 'Расчётный счёт' },
  { id: '10000000-0000-0000-0000-000000000002', label: 'Касса (наличные)' },
];

type Counterparty = { id: string; name: string };
type AgingFilter = 'all' | '0-30' | '31-60' | '60+';
type DebtorCategoryFilter = 'all' | 'unbilled' | 'legal' | 'individual';

const PAYMENT_LABELS: Record<string, string> = {
  bank_invoice: 'Безнал',
  debt_cash: 'Долг нал',
  qr: 'QR',
  cash: 'Нал',
  card_driver: 'Нал/Карта',
};

const STATUS_CONFIG = {
  active: { label: 'В работе', bg: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400' },
  promised: { label: 'Обещание', bg: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  disputed: { label: 'Оспаривает', bg: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
  bad_debt: { label: 'Безнадёжный', bg: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
};

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function passesAgingFilter(debtor: Debtor, filter: AgingFilter): boolean {
  const days = daysAgo(debtor.oldest_at);
  if (filter === '0-30') return days <= 30;
  if (filter === '31-60') return days > 30 && days <= 60;
  if (filter === '60+') return days > 60;
  return true;
}

function EmailCopyButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-[10px] text-slate-500 font-bold hover:text-slate-700 flex items-center gap-0.5 transition-colors"
      title="Скопировать e-mail"
    >
      <span className="material-symbols-outlined text-xs">{copied ? 'check_circle' : 'mail'}</span>
      <span className={copied ? 'text-green-600' : ''}>{copied ? 'Скопировано' : email}</span>
    </button>
  );
}

function PromiseDateBadge({ follow_up }: { follow_up: FollowUp | null }) {
  if (!follow_up?.promise_date) return null;
  const today = new Date().toISOString().split('T')[0]!;
  const diff = Math.floor((new Date(follow_up.promise_date).getTime() - Date.now()) / 86400000);
  const isOverdue = follow_up.promise_date < today;
  return (
    <span
      className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
        isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'
      }`}
    >
      {isOverdue
        ? `⚠ Обещание просрочено ${Math.abs(diff)} дн.`
        : `Обещает ${new Date(follow_up.promise_date + 'T12:00:00').toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
          })} (через ${diff} дн.)`}
    </span>
  );
}

function FollowUpForm({
  counterpartyId,
  current,
  onClose,
  onSaved,
}: {
  counterpartyId: string;
  current: FollowUp | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<keyof typeof STATUS_CONFIG>(current?.status ?? 'active');
  const [promiseDate, setPromiseDate] = useState(current?.promise_date ?? '');
  const [nextContact, setNextContact] = useState(current?.next_contact_at ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      fetch(`/api/receivables/follow-up/${counterpartyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          promise_date: promiseDate || null,
          next_contact_at: nextContact || null,
          notes: notes || null,
        }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
        return json;
      }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mx-6 mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Фиксация звонка
        </p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          Object.entries(STATUS_CONFIG) as [
            keyof typeof STATUS_CONFIG,
            (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG],
          ][]
        ).map(([key, cfg]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide border-2 transition-colors ${
              status === key
                ? `${cfg.bg} border-current`
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {status === 'promised' && (
        <div>
          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
            Обещает оплатить
          </label>
          <input
            type="date"
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Следующий звонок
        </label>
        <input
          type="date"
          value={nextContact}
          onChange={(e) => setNextContact(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Заметка
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Итог звонка..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Сохранение...' : '✓ Зафиксировать звонок'}
      </button>
    </div>
  );
}

function AddDebtForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [cpId, setCpId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    staleTime: 60000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cpId || !amount || !date) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch('/api/receivables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterparty_id: cpId, amount, date, description }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Добавить исторический долг</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Контрагент
            </label>
            <select
              value={cpId}
              onChange={(e) => setCpId(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Выберите...</option>
              {(Array.isArray(counterparties) ? counterparties : []).map((cp) => (
                <option key={cp.id} value={cp.id}>
                  {cp.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Сумма, ₽
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Дата возникновения
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Описание (необязательно)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="За что долг..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !cpId || !amount}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Добавить долг'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type InvoiceModalData = {
  orderId: string;
  tripNumber: number | null;
  counterpartyName: string;
  amount: string;
  currentNumber: string;
  currentDate: string;
};

function InvoiceModal({
  data,
  onClose,
  onSuccess,
}: {
  data: InvoiceModalData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(data.currentNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(
    data.currentDate || new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      setError('Введите номер счёта или акта');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/receivables/invoice/${data.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ошибка сохранения');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">receipt_long</span>
            <h2 className="text-base font-black text-slate-900">
              {data.currentNumber ? 'Изменить номер счёта' : 'Выставить счёт (Акт)'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Клиент:</span>
            <span className="font-bold text-slate-800 text-right">{data.counterpartyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Рейс:</span>
            <span className="font-bold text-slate-800">
              {data.tripNumber ? `№ ${data.tripNumber}` : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Сумма:</span>
            <span className="font-black text-slate-900">
              {parseFloat(data.amount).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Номер счёта / акта
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Например, 38 или № 38"
              autoFocus
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Дата выставления
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : '✓ Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CounterpartyArchiveList({ counterpartyId }: { counterpartyId: string }) {
  const { data, isLoading, isError } = useQuery<{ archive: any[] }>({
    queryKey: ['receivables-archive', counterpartyId],
    queryFn: () => fetch(`/api/receivables/archive/${counterpartyId}`).then((r) => r.json()),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2 animate-pulse">
        <div className="h-12 bg-slate-200/60 rounded-xl" />
        <div className="h-12 bg-slate-200/60 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
        Ошибка загрузки архива
      </div>
    );
  }

  const archive = data?.archive ?? [];

  if (archive.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <span className="material-symbols-outlined text-slate-300 text-3xl">inventory_2</span>
        <p className="text-xs text-slate-400 font-medium mt-1">
          В архиве пока нет оплаченных счетов по этому контрагенту
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs shadow-xs">
      <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
        <span>Оплаченные акты и рейсы ({archive.length})</span>
        <span>Безналичный расчёт</span>
      </div>
      {archive.map((item) => (
        <div
          key={item.id}
          className="p-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs">
              {item.invoice_number ? `Акт № ${item.invoice_number}` : 'Б/н'}
            </span>
            <div>
              <div className="font-bold text-slate-800">
                {item.trip?.trip_number
                  ? `Рейс #${item.trip.trip_number}`
                  : item.description || 'Заказ'}
                {item.trip?.asset?.reg_number && ` · ${item.trip.asset.reg_number}`}
                {item.trip?.driver?.name && ` (${item.trip.driver.name})`}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                {item.invoice_date && `Выставлен: ${formatDate(item.invoice_date)} · `}
                {item.invoice_paid_at ? `Оплачен: ${formatDate(item.invoice_paid_at)}` : 'Погашен'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-black text-slate-800 text-sm">
              <Money amount={item.amount} />
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>Оплачено на Р/С</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

type CloseAllModal = { debtor: Debtor; orders: Order[]; walletId: string };

function selectByAmount(
  orders: Order[],
  targetAmount: number,
): { selectedIds: string[]; info: string } {
  if (isNaN(targetAmount) || targetAmount <= 0) {
    return { selectedIds: [], info: 'Введите корректную сумму' };
  }
  const sorted = [...orders].sort((a, b) => {
    const da = new Date(a.started_at || a.created_at).getTime();
    const db = new Date(b.started_at || b.created_at).getTime();
    return da - db;
  });

  let remaining = targetAmount;
  const selected: string[] = [];
  let sumSelected = 0;

  for (const o of sorted) {
    const amt = parseFloat(o.amount || '0');
    if (amt <= 0) continue;
    if (remaining >= amt) {
      selected.push(o.id);
      remaining -= amt;
      sumSelected += amt;
    }
  }

  const remainderStr = remaining.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const sumStr = sumSelected.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  let infoMsg = `Отмечено ${selected.length} записей на ${sumStr} ₽`;
  if (remaining > 0) {
    infoMsg += ` (остаток нераспределен: ${remainderStr} ₽)`;
  }
  return { selectedIds: selected, info: infoMsg };
}

export default function ReceivablesPage() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<DebtorCategoryFilter>('all');
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Sub-tabs
  const [closeAllModal, setCloseAllModal] = useState<CloseAllModal | null>(null);
  const [closingAllId, setClosingAllId] = useState<string | null>(null);
  const [linkingOrderId, setLinkingOrderId] = useState<string | null>(null);
  const [linkCpSearch, setLinkCpSearch] = useState('');
  const [linkingPending, setLinkingPending] = useState(false);
  const [clientTabs, setClientTabs] = useState<Record<string, 'active' | 'archive'>>({});
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<InvoiceModalData | null>(null);

  // Partial payment state
  const [partialModalOrder, setPartialModalOrder] = useState<Order | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialWallet, setPartialWallet] = useState<string>(
    '10000000-0000-0000-0000-000000000001',
  );
  const [partialSaving, setPartialSaving] = useState(false);
  const [partialError, setPartialError] = useState('');

  // Selection & Lump Sum state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [lumpSumAmounts, setLumpSumAmounts] = useState<Record<string, string>>({});
  const [lumpSumInfo, setLumpSumInfo] = useState<Record<string, string>>({});

  async function handlePartialPay() {
    if (!partialModalOrder) return;
    const amt = parseFloat(partialAmount);
    if (isNaN(amt) || amt <= 0) {
      setPartialError('Введите корректную сумму');
      return;
    }
    if (amt >= parseFloat(partialModalOrder.amount)) {
      setPartialError('Сумма частичной оплаты должна быть меньше суммы долга');
      return;
    }
    setPartialSaving(true);
    setPartialError('');
    try {
      const isManual = partialModalOrder.type === 'manual';
      const endpoint = isManual
        ? `/api/receivables/manual/${partialModalOrder.id}/partial`
        : `/api/receivables/${partialModalOrder.id}/partial`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, to_wallet_id: partialWallet }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Ошибка частичной оплаты');
      setPartialModalOrder(null);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (err: unknown) {
      setPartialError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setPartialSaving(false);
    }
  }

  function toggleOrderSelection(orderId: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAllDebtorOrders(debtor: Debtor) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      debtor.orders.forEach((o) => next.add(o.id));
      return next;
    });
  }

  function deselectAllDebtorOrders(debtor: Debtor) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      debtor.orders.forEach((o) => next.delete(o.id));
      return next;
    });
  }

  useEffect(() => {
    if (!expandedId) return;
    const el = document.querySelector(`[data-debtor-id="${expandedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandedId]);

  useEffect(() => {
    if (!editingFollowUpId) return;
    const el = document.querySelector(`[data-followup-id="${editingFollowUpId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [editingFollowUpId]);

  const { data, isLoading, isError } = useQuery<ReceivablesData>({
    queryKey: ['receivables'],
    queryFn: () => fetch('/api/receivables').then((r) => r.json()),
    staleTime: 30000,
  });

  const { data: counterparties = [] } = useQuery<Counterparty[]>({
    queryKey: ['counterparties-active'],
    queryFn: () => fetch('/api/counterparties?active=1').then((r) => r.json()),
    enabled: linkingOrderId !== null,
    staleTime: 60000,
  });

  const allDebtors = data?.debtors ?? [];

  // Filter calculation
  const unbilledCount = allDebtors.filter((d) =>
    d.orders.some(
      (o) => o.type === 'trip_order' && (!o.invoice_number || o.invoice_status === 'unbilled'),
    ),
  ).length;

  const legalCount = allDebtors.filter((d) => d.is_legal_entity).length;
  const individualCount = allDebtors.filter((d) => !d.is_legal_entity).length;

  const filteredDebtors = allDebtors.filter((debtor) => {
    // 1. Category filter
    if (categoryFilter === 'unbilled') {
      const hasUnbilled = debtor.orders.some(
        (o) => o.type === 'trip_order' && (!o.invoice_number || o.invoice_status === 'unbilled'),
      );
      if (!hasUnbilled) return false;
    } else if (categoryFilter === 'legal') {
      if (!debtor.is_legal_entity) return false;
    } else if (categoryFilter === 'individual') {
      if (debtor.is_legal_entity) return false;
    }

    // 2. Aging filter
    if (!passesAgingFilter(debtor, agingFilter)) return false;

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = debtor.counterparty_name.toLowerCase().includes(q);
      const matchesSubname = debtor.counterparty_subname?.toLowerCase().includes(q);
      const matchesPhone = debtor.counterparty_phone?.includes(q);
      const matchesOrder = debtor.orders.some(
        (o) =>
          String(o.trip_number).includes(q) ||
          o.invoice_number?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.driver_name?.toLowerCase().includes(q) ||
          o.asset_reg_number?.toLowerCase().includes(q),
      );
      if (!matchesName && !matchesSubname && !matchesPhone && !matchesOrder) return false;
    }

    return true;
  });

  function countByAging(filter: AgingFilter) {
    return allDebtors.filter((d) => passesAgingFilter(d, filter)).length;
  }

  async function handleMarkPaid(order: Order, defaultWalletId?: string) {
    setMarkingId(order.id);
    try {
      const url =
        order.type === 'manual'
          ? `/api/receivables/manual/${order.id}`
          : `/api/receivables/${order.id}`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: defaultWalletId ? JSON.stringify({ to_wallet_id: defaultWalletId }) : undefined,
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setMarkingId(null);
    }
  }

  async function handleDeleteManual(orderId: string) {
    if (!confirm('Удалить эту запись?')) return;
    setDeletingId(orderId);
    try {
      const r = await fetch(`/api/receivables/manual/${orderId}`, { method: 'DELETE' });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCloseAll(debtor: Debtor, ordersToClose: Order[], walletId: string) {
    setClosingAllId(debtor.counterparty_id);
    try {
      const r = await fetch('/api/receivables/close-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: ordersToClose.map((o) => ({ id: o.id, type: o.type, amount: o.amount })),
          to_wallet_id: walletId,
          counterparty_name: debtor.counterparty_name,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? `Статус ${r.status}`);
      setCloseAllModal(null);
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        ordersToClose.forEach((o) => next.delete(o.id));
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setClosingAllId(null);
    }
  }

  function handleAddSuccess() {
    setShowAddForm(false);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
  }

  async function handleLinkToCounterparty(debtor: Debtor, cpId: string) {
    setLinkingPending(true);
    try {
      await Promise.all(
        debtor.orders.map((o) =>
          fetch(`/api/receivables/${o.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ counterparty_id: cpId }),
          }).then(async (r) => {
            if (!r.ok) {
              const json = await r.json();
              throw new Error(json.error ?? `Статус ${r.status}`);
            }
          }),
        ),
      );
      setLinkingOrderId(null);
      setLinkCpSearch('');
      await queryClient.invalidateQueries({ queryKey: ['receivables'] });
      await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
    } catch (e: unknown) {
      alert('Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLinkingPending(false);
    }
  }

  function handleFollowUpSaved() {
    setEditingFollowUpId(null);
    queryClient.invalidateQueries({ queryKey: ['receivables'] });
    queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
  }

  const promisedCount = allDebtors.filter((d) => d.follow_up?.status === 'promised').length;

  return (
    <>
      {showAddForm && (
        <AddDebtForm onClose={() => setShowAddForm(false)} onSuccess={handleAddSuccess} />
      )}

      {invoiceModalOrder && (
        <InvoiceModal
          data={invoiceModalOrder}
          onClose={() => setInvoiceModalOrder(null)}
          onSuccess={async () => {
            setInvoiceModalOrder(null);
            await queryClient.invalidateQueries({ queryKey: ['receivables'] });
            await queryClient.invalidateQueries({ queryKey: ['receivables-summary'] });
          }}
        />
      )}

      {closeAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">
                {closeAllModal.orders.length === closeAllModal.debtor.orders.length
                  ? 'Закрыть весь долг'
                  : `Погасить ${closeAllModal.orders.length} выбр. записей`}
              </h2>
              <button
                onClick={() => setCloseAllModal(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-xs text-slate-500 font-medium">
                {closeAllModal.debtor.counterparty_name}
              </p>
              <p className="text-2xl font-black text-emerald-600">
                <Money
                  amount={closeAllModal.orders
                    .reduce((s, o) => s + parseFloat(o.amount || '0'), 0)
                    .toFixed(2)}
                />
              </p>
              <p className="text-[10px] text-slate-400">
                {closeAllModal.orders.length}{' '}
                {closeAllModal.orders.length === 1 ? 'запись' : 'записей'} из{' '}
                {closeAllModal.debtor.orders.length} будут закрыты
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Деньги поступят в
              </p>
              <div className="space-y-2">
                {WALLET_OPTIONS.map((w) => (
                  <label
                    key={w.id}
                    className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50"
                  >
                    <input
                      type="radio"
                      name="wallet"
                      value={w.id}
                      checked={closeAllModal.walletId === w.id}
                      onChange={() => setCloseAllModal({ ...closeAllModal, walletId: w.id })}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm font-bold text-slate-700">{w.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setCloseAllModal(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() =>
                  handleCloseAll(closeAllModal.debtor, closeAllModal.orders, closeAllModal.walletId)
                }
                disabled={closingAllId === closeAllModal.debtor.counterparty_id}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {closingAllId === closeAllModal.debtor.counterparty_id
                  ? 'Закрываем...'
                  : '✓ Погасить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {partialModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Частичная оплата</h2>
              <button
                onClick={() => setPartialModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Текущий остаток долга
              </p>
              <p className="text-xl font-black text-slate-900">
                <Money amount={partialModalOrder.amount} />
              </p>
            </div>

            {partialError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-600">
                {partialError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Сумма оплаты (₽)
                </label>
                <input
                  type="number"
                  step="any"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Например, 5000"
                  autoFocus
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  Зачислить в кошелёк
                </label>
                <div className="space-y-2">
                  {WALLET_OPTIONS.map((w) => (
                    <label
                      key={w.id}
                      className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                    >
                      <input
                        type="radio"
                        name="partialWallet"
                        value={w.id}
                        checked={partialWallet === w.id}
                        onChange={() => setPartialWallet(w.id)}
                        className="accent-blue-600"
                      />
                      <span className="text-xs font-semibold text-slate-700">{w.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPartialModalOrder(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handlePartialPay}
                disabled={partialSaving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {partialSaving ? '...' : 'Зачислить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3 p-2 sm:p-4 max-w-7xl mx-auto animate-in fade-in duration-300">
        {/* Compact Header */}
        <div className="bg-white px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                Дебиторская задолженность
              </h1>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {allDebtors.length} {allDebtors.length === 1 ? 'контрагент' : 'контрагентов'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                Всего к получению:
              </span>
              <span className="text-lg sm:text-xl font-black text-rose-600">
                <Money amount={data?.totalAmount ?? '0'} />
              </span>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Добавить долг</span>
            </button>
          </div>
        </div>

        {/* Compact KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-200 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Всего к получению
              </p>
              <p className="text-base sm:text-lg font-black text-rose-600 mt-0.5">
                <Money amount={data?.totalAmount ?? '0'} />
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Всего должников
              </p>
              <p className="text-base sm:text-lg font-black text-slate-800 mt-0.5">
                {allDebtors.length}
              </p>
            </div>
            <div
              className={`border rounded-xl p-2.5 shadow-xs ${
                (data?.overdueCount ?? 0) > 0
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Просрочено (&gt;30 дн.)
              </p>
              <p
                className={`text-base sm:text-lg font-black mt-0.5 ${
                  (data?.overdueCount ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {data?.overdueCount ?? 0}
              </p>
            </div>
            <div
              className={`border rounded-xl p-2.5 shadow-xs ${
                promisedCount > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
              }`}
            >
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Обещали заплатить
              </p>
              <p
                className={`text-base sm:text-lg font-black mt-0.5 ${
                  promisedCount > 0 ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                {promisedCount}
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-bold">
            Ошибка загрузки данных
          </div>
        )}

        {/* Compact Filters & Quick Search (как в согласованном макете) */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Все должники ({allDebtors.length})
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('unbilled')}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                categoryFilter === 'unbilled'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Ждут выставления счёта ({unbilledCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('legal')}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                categoryFilter === 'legal'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Только Юрлица (Р/С) ({legalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setCategoryFilter('individual')}
              className={`px-3 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                categoryFilter === 'individual'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Физлица (в кассу) ({individualCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick search input */}
            <div className="relative min-w-[220px]">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск контрагента, № акта..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            {/* Aging filter dropdown / pills */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-0.5 text-[11px]">
              {(
                [
                  { key: 'all', label: 'Все сроки' },
                  { key: '0-30', label: `0–30 дн. (${countByAging('0-30')})` },
                  { key: '31-60', label: `31–60 дн. (${countByAging('31-60')})` },
                  { key: '60+', label: `60+ дн. (${countByAging('60+')})` },
                ] as { key: AgingFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAgingFilter(key)}
                  className={`px-2 py-1 rounded-lg font-bold transition-colors ${
                    agingFilter === key
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Debtors List (Accordion) */}
        <section className="space-y-1.5">
          {isLoading ? (
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : filteredDebtors.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="material-symbols-outlined text-slate-200 text-[56px]">
                check_circle
              </span>
              <p className="text-slate-500 font-bold mt-2 text-xs">
                {categoryFilter === 'all' && !searchQuery
                  ? 'Дебиторской задолженности нет'
                  : 'По выбранным фильтрам контрагентов не найдено'}
              </p>
              {(categoryFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setCategoryFilter('all');
                    setSearchQuery('');
                    setAgingFilter('all');
                  }}
                  className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredDebtors.map((debtor) => {
                const days = daysAgo(debtor.oldest_at);
                const isOverdue = days > 30;
                const isExpanded = expandedId === debtor.counterparty_id;
                const isReal =
                  !debtor.is_individual && !String(debtor.counterparty_id).startsWith('__');
                const isLegal = !!debtor.is_legal_entity;
                const fu = debtor.follow_up;
                const statusCfg = fu ? STATUS_CONFIG[fu.status] : null;

                // Trip orders requiring invoice issuance
                const unbilledOrders = debtor.orders.filter(
                  (o) =>
                    o.type === 'trip_order' &&
                    (!o.invoice_number || o.invoice_status === 'unbilled'),
                );
                const issuedOrders = debtor.orders.filter(
                  (o) =>
                    o.type === 'manual' ||
                    (o.type === 'trip_order' &&
                      o.invoice_number &&
                      o.invoice_status !== 'unbilled'),
                );
                const unbilledOrdersSum = unbilledOrders.reduce(
                  (sum, o) => sum + parseFloat(o.amount || '0'),
                  0,
                );

                const activeTab = clientTabs[debtor.counterparty_id] ?? 'active';

                return (
                  <div
                    key={debtor.counterparty_id}
                    data-debtor-id={debtor.counterparty_id}
                    className={`bg-white border rounded-xl shadow-xs overflow-hidden transition-all ${
                      isExpanded
                        ? 'border-blue-300 ring-2 ring-blue-50'
                        : unbilledOrders.length > 0 && isLegal
                          ? 'border-amber-200 hover:border-amber-300'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Debtor Compact Single-Line Header Row */}
                    <div
                      className={`px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-50 select-none transition-colors ${
                        isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : ''
                      }`}
                      onClick={() => {
                        setExpandedId(isExpanded ? null : debtor.counterparty_id);
                        setEditingFollowUpId(null);
                      }}
                    >
                      {/* Left: Avatar, Name, Badges, Info all in 1 single row */}
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] shrink-0 ${
                            isLegal
                              ? 'bg-blue-100 text-blue-800'
                              : isOverdue
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {debtor.counterparty_name.slice(0, 2).toUpperCase()}
                        </div>

                        <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[200px] lg:max-w-xs">
                          {debtor.counterparty_name}
                        </span>

                        {debtor.counterparty_subname && (
                          <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 hidden sm:inline">
                            {debtor.counterparty_subname}
                          </span>
                        )}

                        {isLegal ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                            Юрлицо
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            Физлицо
                          </span>
                        )}

                        {unbilledOrders.length > 0 && isLegal && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>{unbilledOrders.length} ждут счёта</span>
                          </span>
                        )}

                        {statusCfg && (
                          <span
                            className={`hidden md:inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${statusCfg.bg}`}
                          >
                            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 shrink-0 hidden md:inline">
                          {debtor.orders.length} зап. ·{' '}
                          {isOverdue ? (
                            <span className="text-rose-600 font-bold">просрочка {days} дн.</span>
                          ) : (
                            <span>{days} дн.</span>
                          )}
                        </span>

                        {debtor.counterparty_phone && (
                          <a
                            href={`tel:${debtor.counterparty_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] text-blue-600 font-medium hover:text-blue-800 hidden lg:flex items-center gap-0.5 shrink-0"
                            title={debtor.counterparty_phone}
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            <span className="font-mono">
                              {formatPhone(debtor.counterparty_phone)}
                            </span>
                          </a>
                        )}

                        {debtor.counterparty_email && (
                          <span className="hidden xl:inline shrink-0">
                            <EmailCopyButton email={debtor.counterparty_email} />
                          </span>
                        )}

                        <PromiseDateBadge follow_up={fu} />
                      </div>

                      {/* Right: Sum + Actions in 1 single row */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-black tracking-tight ${
                            isOverdue ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          <Money amount={debtor.total} />
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(debtor.counterparty_id);
                            setLinkingOrderId(debtor.counterparty_id);
                          }}
                          className="px-2 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors shrink-0 flex items-center gap-0.5"
                          title="Привязать к контрагенту"
                        >
                          <span className="material-symbols-outlined text-xs">link</span>
                          <span className="hidden sm:inline">
                            {isReal ? 'Сменить' : 'Привязать'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : debtor.counterparty_id);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wide transition-colors shrink-0 flex items-center gap-0.5"
                        >
                          <span
                            className="material-symbols-outlined text-sm transition-transform duration-200"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                          >
                            expand_more
                          </span>
                          <span className="hidden sm:inline">
                            {isExpanded ? 'Свернуть' : 'Подробнее'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Accordion Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-4">
                        {/* Sub-tabs for Legal Entity: Current vs Archive */}
                        {isLegal && (
                          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-200 pb-2 text-xs">
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setClientTabs((prev) => ({
                                    ...prev,
                                    [debtor.counterparty_id]: 'active',
                                  }))
                                }
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                  activeTab === 'active'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span>Текущие счета и рейсы ({debtor.orders.length})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setClientTabs((prev) => ({
                                    ...prev,
                                    [debtor.counterparty_id]: 'archive',
                                  }))
                                }
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                                  activeTab === 'archive'
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">history</span>
                                <span>Архив оплаченных</span>
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">
                              Безналичный расчёт на Р/С · Без НДС
                            </span>
                          </div>
                        )}

                        {/* If archive tab is selected for legal entity */}
                        {isLegal && activeTab === 'archive' ? (
                          <CounterpartyArchiveList counterpartyId={debtor.counterparty_id} />
                        ) : (
                          <>
                            {/* Counterparty linking input if opened */}
                            {linkingOrderId === debtor.counterparty_id && (
                              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl space-y-2">
                                <p className="text-[10px] font-bold text-violet-800 uppercase tracking-widest">
                                  Выберите контрагента для привязки
                                </p>
                                <input
                                  type="text"
                                  value={linkCpSearch}
                                  onChange={(e) => setLinkCpSearch(e.target.value)}
                                  placeholder="Поиск по названию..."
                                  autoFocus
                                  className="w-full bg-white border border-violet-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                                {(Array.isArray(counterparties) ? counterparties : []).filter(
                                  (cp) =>
                                    !linkCpSearch ||
                                    cp.name.toLowerCase().includes(linkCpSearch.toLowerCase()),
                                ).length > 0 && (
                                  <div className="max-h-40 overflow-y-auto border border-violet-200 rounded-lg divide-y divide-violet-100 bg-white shadow-xs">
                                    {(Array.isArray(counterparties) ? counterparties : [])
                                      .filter(
                                        (cp) =>
                                          !linkCpSearch ||
                                          cp.name
                                            .toLowerCase()
                                            .includes(linkCpSearch.toLowerCase()),
                                      )
                                      .map((cp) => (
                                        <button
                                          key={cp.id}
                                          type="button"
                                          onClick={() => handleLinkToCounterparty(debtor, cp.id)}
                                          disabled={linkingPending}
                                          className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-violet-100 hover:text-violet-800 transition-colors disabled:opacity-50 font-medium"
                                        >
                                          {cp.name}
                                        </button>
                                      ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkingOrderId(null);
                                    setLinkCpSearch('');
                                  }}
                                  className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                >
                                  Отмена
                                </button>
                              </div>
                            )}

                            {/* Follow-up panel for real counterparties */}
                            {isReal && (
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                                {fu ? (
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span
                                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${statusCfg?.bg}`}
                                        >
                                          <span
                                            className={`w-1.5 h-1.5 rounded-full ${statusCfg?.dot}`}
                                          />
                                          {statusCfg?.label}
                                        </span>
                                        {fu.last_contact_at && (
                                          <span className="text-[10px] text-slate-400">
                                            Последний звонок: {formatDate(fu.last_contact_at)}
                                          </span>
                                        )}
                                        {fu.next_contact_at && (
                                          <span className="text-[10px] text-blue-600 font-bold">
                                            Следующий:{' '}
                                            {new Date(
                                              fu.next_contact_at + 'T12:00:00',
                                            ).toLocaleDateString('ru-RU', {
                                              day: 'numeric',
                                              month: 'short',
                                            })}
                                          </span>
                                        )}
                                      </div>
                                      {fu.notes && (
                                        <p className="text-xs text-slate-600 italic">
                                          «{fu.notes}»
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingFollowUpId(
                                          editingFollowUpId === debtor.counterparty_id
                                            ? null
                                            : debtor.counterparty_id,
                                        );
                                      }}
                                      className="shrink-0 px-2.5 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors uppercase tracking-wide bg-white"
                                    >
                                      <span className="material-symbols-outlined text-xs align-middle mr-1">
                                        call
                                      </span>
                                      Обновить
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-400 font-medium">
                                      История звонков не зафиксирована
                                    </p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingFollowUpId(
                                          editingFollowUpId === debtor.counterparty_id
                                            ? null
                                            : debtor.counterparty_id,
                                        );
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors uppercase tracking-wide"
                                    >
                                      <span className="material-symbols-outlined text-xs align-middle mr-1">
                                        add_call
                                      </span>
                                      Зафиксировать звонок
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {isReal && editingFollowUpId === debtor.counterparty_id && (
                              <div data-followup-id={debtor.counterparty_id}>
                                <FollowUpForm
                                  counterpartyId={debtor.counterparty_id}
                                  current={debtor.follow_up}
                                  onClose={() => setEditingFollowUpId(null)}
                                  onSaved={handleFollowUpSaved}
                                />
                              </div>
                            )}

                            {/* Unbilled Notice Banner for Legal Entity */}
                            {isLegal && unbilledOrders.length > 0 && (
                              <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-black text-amber-900 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-base text-amber-600">
                                      notification_important
                                    </span>
                                    <span>
                                      Требует выставления счёта ({unbilledOrders.length}{' '}
                                      {unbilledOrders.length === 1 ? 'рейс' : 'рейсов'}):
                                    </span>
                                  </span>
                                  <span className="font-black text-amber-900">
                                    {unbilledOrdersSum.toLocaleString('ru-RU')} ₽
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {unbilledOrders.map((unb) => (
                                    <div
                                      key={unb.id}
                                      className="bg-white p-3 rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="bg-amber-100 text-amber-900 font-mono font-bold px-1.5 py-0.5 rounded">
                                            {unb.trip_number ? `Рейс #${unb.trip_number}` : 'Заказ'}
                                          </span>
                                          <span className="font-bold text-slate-800">
                                            {unb.started_at
                                              ? formatDate(unb.started_at)
                                              : formatDate(unb.created_at)}
                                          </span>
                                          {(unb.asset_reg_number || unb.asset_name) && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <span className="text-slate-600 font-medium">
                                                {unb.asset_reg_number ?? ''} {unb.asset_name ?? ''}
                                              </span>
                                            </>
                                          )}
                                          {unb.driver_name && (
                                            <>
                                              <span className="text-slate-300">·</span>
                                              <span className="text-slate-500">
                                                {unb.driver_name}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        {unb.description && (
                                          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                            {unb.description}
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        <span className="font-black text-slate-900 text-sm">
                                          <Money amount={unb.amount} />
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setInvoiceModalOrder({
                                              orderId: unb.id,
                                              tripNumber: unb.trip_number,
                                              counterpartyName: debtor.counterparty_name,
                                              amount: unb.amount,
                                              currentNumber: unb.invoice_number || '',
                                              currentDate:
                                                unb.invoice_date ||
                                                new Date().toISOString().slice(0, 10),
                                            })
                                          }
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1 text-xs"
                                        >
                                          <span className="material-symbols-outlined text-xs">
                                            edit_note
                                          </span>
                                          <span>Ввести номер счёта</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Batch Actions & Lump Sum auto-selection bar */}
                            <div className="p-3 bg-slate-100/90 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-700">Погасить на сумму:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  placeholder="Сумма, ₽"
                                  value={lumpSumAmounts[debtor.counterparty_id] ?? ''}
                                  onChange={(e) =>
                                    setLumpSumAmounts((prev) => ({
                                      ...prev,
                                      [debtor.counterparty_id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = parseFloat(
                                        lumpSumAmounts[debtor.counterparty_id] || '0',
                                      );
                                      const res = selectByAmount(debtor.orders, val);
                                      setSelectedOrderIds((prev) => {
                                        const next = new Set(prev);
                                        debtor.orders.forEach((o) => next.delete(o.id));
                                        res.selectedIds.forEach((id) => next.add(id));
                                        return next;
                                      });
                                      setLumpSumInfo((prev) => ({
                                        ...prev,
                                        [debtor.counterparty_id]: res.info,
                                      }));
                                    }
                                  }}
                                  className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const val = parseFloat(
                                      lumpSumAmounts[debtor.counterparty_id] || '0',
                                    );
                                    const res = selectByAmount(debtor.orders, val);
                                    setSelectedOrderIds((prev) => {
                                      const next = new Set(prev);
                                      debtor.orders.forEach((o) => next.delete(o.id));
                                      res.selectedIds.forEach((id) => next.add(id));
                                      return next;
                                    });
                                    setLumpSumInfo((prev) => ({
                                      ...prev,
                                      [debtor.counterparty_id]: res.info,
                                    }));
                                  }}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                  Подобрать
                                </button>

                                <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    const allSelected = debtor.orders.every((o) =>
                                      selectedOrderIds.has(o.id),
                                    );
                                    if (allSelected) deselectAllDebtorOrders(debtor);
                                    else selectAllDebtorOrders(debtor);
                                  }}
                                  className="font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                >
                                  {debtor.orders.every((o) => selectedOrderIds.has(o.id))
                                    ? 'Снять выбор'
                                    : `Выбрать все (${debtor.orders.length})`}
                                </button>
                              </div>

                              {(() => {
                                const selectedOrders = debtor.orders.filter((o) =>
                                  selectedOrderIds.has(o.id),
                                );
                                const sumSelected = selectedOrders.reduce(
                                  (s, o) => s + parseFloat(o.amount || '0'),
                                  0,
                                );
                                const sumSelectedStr = sumSelected.toFixed(2);

                                if (selectedOrders.length === 0) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCloseAllModal({
                                          debtor,
                                          orders: debtor.orders,
                                          walletId: isLegal
                                            ? '10000000-0000-0000-0000-000000000001'
                                            : '10000000-0000-0000-0000-000000000002',
                                        })
                                      }
                                      disabled={closingAllId === debtor.counterparty_id}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-xs"
                                    >
                                      {closingAllId === debtor.counterparty_id
                                        ? 'Закрываем...'
                                        : 'Закрыть весь долг'}
                                    </button>
                                  );
                                }

                                return (
                                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                                    <span className="font-black text-emerald-900">
                                      Выбрано {selectedOrders.length}:{' '}
                                      <Money amount={sumSelectedStr} />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCloseAllModal({
                                          debtor,
                                          orders: selectedOrders,
                                          walletId: isLegal
                                            ? '10000000-0000-0000-0000-000000000001'
                                            : '10000000-0000-0000-0000-000000000002',
                                        })
                                      }
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-md shadow-xs transition-colors flex items-center gap-1"
                                    >
                                      <span className="material-symbols-outlined text-sm">
                                        done_all
                                      </span>
                                      Погасить ({selectedOrders.length})
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>

                            {lumpSumInfo[debtor.counterparty_id] && (
                              <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base text-blue-600">
                                  info
                                </span>
                                {lumpSumInfo[debtor.counterparty_id]}
                              </div>
                            )}

                            {/* Orders Table / Cards */}
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                              {isLegal && (
                                <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                  <span>
                                    {issuedOrders.length > 0
                                      ? `Выставленные акты (ждут оплаты): ${issuedOrders.length}`
                                      : 'Все текущие записи'}
                                  </span>
                                  <span>Оплата на Расчётный счёт</span>
                                </div>
                              )}

                              <table className="w-full text-left">
                                <thead className="bg-slate-100/60 border-b border-slate-100">
                                  <tr>
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest w-10 text-center">
                                      <input
                                        type="checkbox"
                                        checked={
                                          debtor.orders.length > 0 &&
                                          debtor.orders.every((o) => selectedOrderIds.has(o.id))
                                        }
                                        onChange={(e) => {
                                          if (e.target.checked) selectAllDebtorOrders(debtor);
                                          else deselectAllDebtorOrders(debtor);
                                        }}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        title="Выбрать все"
                                      />
                                    </th>
                                    {isLegal && (
                                      <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        Акт / Счёт
                                      </th>
                                    )}
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                      Рейс / Описание
                                    </th>
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                      Транспорт / Водитель
                                    </th>
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                      Дата
                                    </th>
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                      Тип
                                    </th>
                                    <th className="px-3 py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest text-right">
                                      Сумма
                                    </th>
                                    <th className="px-3 py-2" />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                  {debtor.orders.map((order) => {
                                    const isSelected = selectedOrderIds.has(order.id);
                                    const isTrip = order.type === 'trip_order';
                                    const hasInvoice = !!order.invoice_number;

                                    return (
                                      <tr
                                        key={order.id}
                                        className={`transition-colors ${
                                          isSelected
                                            ? 'bg-emerald-50/60 hover:bg-emerald-50'
                                            : 'hover:bg-slate-50/60'
                                        }`}
                                      >
                                        <td className="px-3 py-2.5 text-center">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleOrderSelection(order.id)}
                                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                          />
                                        </td>

                                        {/* Invoice Column for Legal Entity */}
                                        {isLegal && (
                                          <td className="px-3 py-2.5 whitespace-nowrap">
                                            {hasInvoice ? (
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                                                  Акт № {order.invoice_number}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setInvoiceModalOrder({
                                                      orderId: order.id,
                                                      tripNumber: order.trip_number,
                                                      counterpartyName: debtor.counterparty_name,
                                                      amount: order.amount,
                                                      currentNumber: order.invoice_number || '',
                                                      currentDate:
                                                        order.invoice_date ||
                                                        new Date().toISOString().slice(0, 10),
                                                    })
                                                  }
                                                  className="text-slate-400 hover:text-blue-600 transition-colors"
                                                  title="Изменить номер или дату счёта"
                                                >
                                                  <span className="material-symbols-outlined text-sm">
                                                    edit
                                                  </span>
                                                </button>
                                              </div>
                                            ) : isTrip ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setInvoiceModalOrder({
                                                    orderId: order.id,
                                                    tripNumber: order.trip_number,
                                                    counterpartyName: debtor.counterparty_name,
                                                    amount: order.amount,
                                                    currentNumber: '',
                                                    currentDate: new Date()
                                                      .toISOString()
                                                      .slice(0, 10),
                                                  })
                                                }
                                                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded font-bold text-[10px] transition-colors inline-flex items-center gap-0.5"
                                              >
                                                <span className="material-symbols-outlined text-xs">
                                                  add
                                                </span>
                                                <span>Ввести счёт</span>
                                              </button>
                                            ) : (
                                              <span className="text-slate-400 text-[10px]">—</span>
                                            )}
                                          </td>
                                        )}

                                        <td className="px-3 py-2.5 font-semibold text-slate-800">
                                          {order.type === 'manual' ? (
                                            <span className="text-blue-600 font-bold">
                                              Ручная запись
                                            </span>
                                          ) : (
                                            <span className="font-bold text-slate-800">
                                              Рейс №{order.trip_number}
                                            </span>
                                          )}
                                          {order.description && (
                                            <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                                              {order.description}
                                            </span>
                                          )}
                                        </td>

                                        <td className="px-3 py-2.5 text-slate-600">
                                          {order.asset_reg_number ? (
                                            <div>
                                              <span className="font-semibold text-slate-800">
                                                {order.asset_reg_number}
                                              </span>
                                              {order.asset_name && (
                                                <span className="text-slate-400 ml-1">
                                                  ({order.asset_name})
                                                </span>
                                              )}
                                            </div>
                                          ) : null}
                                          <div className="text-[10px] text-slate-400">
                                            {order.driver_name ?? '—'}
                                          </div>
                                        </td>

                                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                                          {order.started_at
                                            ? formatDate(order.started_at)
                                            : formatDate(order.created_at)}
                                        </td>

                                        <td className="px-3 py-2.5">
                                          {order.type === 'manual' ? (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[9px] font-bold uppercase">
                                              Ист. долг
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-[9px] font-bold uppercase">
                                              {PAYMENT_LABELS[order.payment_method ?? ''] ??
                                                order.payment_method ??
                                                '—'}
                                            </span>
                                          )}
                                        </td>

                                        <td className="px-3 py-2.5 text-right font-black text-slate-900 text-sm">
                                          <Money amount={order.amount} />
                                        </td>

                                        <td className="px-3 py-2.5 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <button
                                              onClick={() => {
                                                setPartialModalOrder(order);
                                                setPartialAmount('');
                                                setPartialError('');
                                              }}
                                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded transition-colors shrink-0"
                                              title="Частичная оплата"
                                            >
                                              Частично
                                            </button>
                                            {order.type === 'manual' && (
                                              <button
                                                onClick={() => handleDeleteManual(order.id)}
                                                disabled={deletingId === order.id}
                                                className="px-1.5 py-1 text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                                                title="Удалить запись"
                                              >
                                                <span className="material-symbols-outlined text-base">
                                                  delete
                                                </span>
                                              </button>
                                            )}
                                            <button
                                              onClick={() =>
                                                handleMarkPaid(
                                                  order,
                                                  isLegal
                                                    ? '10000000-0000-0000-0000-000000000001'
                                                    : undefined,
                                                )
                                              }
                                              disabled={markingId === order.id}
                                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-xs transition-colors disabled:opacity-50"
                                              title={
                                                isLegal
                                                  ? 'Погасить платёж на Расчётный счёт'
                                                  : 'Погасить'
                                              }
                                            >
                                              {markingId === order.id
                                                ? '...'
                                                : isLegal
                                                  ? 'Погасить (Р/С)'
                                                  : 'Погасить'}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
