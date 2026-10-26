'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Money } from '@saldacargo/ui';

export type BrandKey = 'all' | 'valday' | 'gazelle' | 'canter' | 'consumables';

interface PartItem {
  id: string;
  article: string | null;
  name: string;
  category: string | null;
  unit: string | null;
  min_stock: number;
  purchase_price: number;
  client_price: number;
  stock: number;
  is_low: boolean;
  stock_total_cost: number;
  stock_total_client: number;
}

interface PartsApiResponse {
  parts: PartItem[];
  totals: {
    totalPositions: number;
    totalStockVal: number;
    totalClientVal: number;
    lowStockCount: number;
  };
}

const BRAND_CONFIG: Record<
  string,
  { label: string; icon: string; badgeClass: string; borderClass: string; bgClass: string }
> = {
  valday: {
    label: 'Валдай',
    icon: '🚛',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    borderClass: 'border-amber-300',
    bgClass: 'bg-amber-500/10',
  },
  gazelle: {
    label: 'Газель',
    icon: '🚚',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    borderClass: 'border-sky-300',
    bgClass: 'bg-sky-500/10',
  },
  canter: {
    label: 'Mitsubishi Canter',
    icon: '🚚',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    borderClass: 'border-rose-300',
    bgClass: 'bg-rose-500/10',
  },
  consumables: {
    label: 'Масла / ГСМ',
    icon: '🛢️',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderClass: 'border-emerald-300',
    bgClass: 'bg-emerald-500/10',
  },
};

export function WarehouseSection() {
  const qc = useQueryClient();
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('all');
  const [search, setSearch] = useState('');
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Форма добавления новой детали
  const [newPartForm, setNewPartForm] = useState({
    name: '',
    article: '',
    brand: 'gazelle' as 'valday' | 'gazelle' | 'canter' | 'consumables',
    unit: 'шт',
    initial_stock: '1',
    purchase_price: '0',
    client_price: '0',
    min_stock: '1',
  });

  const { data, isLoading } = useQuery<PartsApiResponse>({
    queryKey: ['garage-parts', selectedBrand, search],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedBrand !== 'all') p.set('brand', selectedBrand);
      if (search) p.set('search', search);
      const res = await fetch(`/api/garage/parts?${p.toString()}`);
      if (!res.ok) throw new Error('Ошибка при загрузке запчастей');
      return res.json();
    },
    staleTime: 15000,
  });

  const parts = data?.parts || [];
  const totals = data?.totals || {
    totalPositions: 0,
    totalStockVal: 0,
    totalClientVal: 0,
    lowStockCount: 0,
  };

  // Мутация сохранения инвентаризации
  const saveInventoryMutation = useMutation({
    mutationFn: async (payload: { items: Array<{ id: string; actual_stock: number }> }) => {
      const res = await fetch('/api/garage/parts/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Не удалось сохранить инвентаризацию');
      }
      return res.json();
    },
    onSuccess: (resData) => {
      setStatusMessage({
        text: `Инвентаризация успешно сохранена! Скорректировано позиций: ${resData.adjustedCount || 0}`,
        type: 'success',
      });
      setEditedStocks({});
      qc.invalidateQueries({ queryKey: ['garage-parts'] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message, type: 'error' });
    },
  });

  // Мутация создания новой детали
  const createPartMutation = useMutation({
    mutationFn: async (body: typeof newPartForm) => {
      const res = await fetch('/api/garage/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Не удалось создать запчасть');
      }
      return res.json();
    },
    onSuccess: () => {
      setStatusMessage({ text: 'Новая запчасть успешно добавлена на склад', type: 'success' });
      setShowAddModal(false);
      setNewPartForm({
        name: '',
        article: '',
        brand: 'gazelle',
        unit: 'шт',
        initial_stock: '1',
        purchase_price: '0',
        client_price: '0',
        min_stock: '1',
      });
      qc.invalidateQueries({ queryKey: ['garage-parts'] });
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (err: Error) => {
      setStatusMessage({ text: err.message, type: 'error' });
    },
  });

  // Проверка наличия несохранённых правок
  const hasPendingChanges = Object.keys(editedStocks).length > 0;

  const handleStockChange = (partId: string, value: number) => {
    const val = Math.max(0, isNaN(value) ? 0 : value);
    setEditedStocks((prev) => ({
      ...prev,
      [partId]: val,
    }));
  };

  const handleSaveInventory = () => {
    const items = Object.entries(editedStocks).map(([id, actual_stock]) => ({
      id,
      actual_stock,
    }));
    if (items.length === 0) return;
    saveInventoryMutation.mutate({ items });
  };

  // Вычисление динамической стоимости с учётом правок
  const liveTotals = useMemo(() => {
    let stockCost = 0;
    let clientVal = 0;
    let positionsWithStock = 0;

    for (const p of parts) {
      const effectiveStock =
        editedStocks[p.id] !== undefined ? (editedStocks[p.id] as number) : p.stock;
      stockCost += effectiveStock * p.purchase_price;
      clientVal += effectiveStock * p.client_price;
      if (effectiveStock > 0) positionsWithStock++;
    }

    return {
      stockCost,
      clientVal,
      positionsWithStock,
      profitPotential: Math.max(0, clientVal - stockCost),
    };
  }, [parts, editedStocks]);

  return (
    <div className="space-y-4">
      {/* ── Верхний информационный блок метрик склада (без чёрного, в светлых тонах) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-sky-100 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Капитал склада
            </span>
            <span className="text-base">💰</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-800">
              <Money amount={liveTotals.stockCost} />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">В ценах закупки (себестоимость)</p>
          </div>
        </div>

        <div className="bg-white border border-emerald-100 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
              Оценка (+30%)
            </span>
            <span className="text-base">🏷️</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-emerald-700">
              <Money amount={liveTotals.clientVal} />
            </div>
            <p className="text-[11px] text-emerald-600/80 mt-0.5 font-medium">
              Маржа: +<Money amount={liveTotals.profitPotential} />
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Всего позиций
            </span>
            <span className="text-base">📦</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-800">
              {totals.totalPositions}{' '}
              <span className="text-xs font-bold text-slate-400">наим.</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              В наличии: {liveTotals.positionsWithStock} наим.
            </p>
          </div>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              Критический остаток
            </span>
            <span className="text-base">⚠️</span>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-700">
              {totals.lowStockCount} <span className="text-xs font-bold text-amber-600">поз.</span>
            </div>
            <p className="text-[11px] text-amber-600/80 mt-0.5 font-medium">Ниже нормы запаса</p>
          </div>
        </div>
      </div>

      {/* ── Сообщение об успешном или ошибочном действии ── */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Панель фильтров по маркам и поиску ── */}
      <div className="bg-white border border-sky-100 rounded-2xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Поиск */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="🔍 Поиск по названию или артикулу детали..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Кнопки действий: Добавить деталь и Сохранить инвентаризацию */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>➕</span>
              <span>Добавить деталь</span>
            </button>

            <button
              onClick={handleSaveInventory}
              disabled={!hasPendingChanges || saveInventoryMutation.isPending}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0 ${
                hasPendingChanges
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95 ring-2 ring-emerald-300'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              }`}
            >
              <span>{saveInventoryMutation.isPending ? '⏳' : '✓'}</span>
              <span>
                {saveInventoryMutation.isPending
                  ? 'Сохранение...'
                  : hasPendingChanges
                    ? `Сохранить пересчёт (${Object.keys(editedStocks).length})`
                    : 'Остатки сверены'}
              </span>
            </button>
          </div>
        </div>

        {/* Марки авто (кнопки быстрого выбора) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Марка авто:</span>

          <button
            onClick={() => setSelectedBrand('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedBrand === 'all'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Все марки ({totals.totalPositions})
          </button>

          <button
            onClick={() => setSelectedBrand('valday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedBrand === 'valday'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <span>🚛</span>
            <span>Валдай</span>
          </button>

          <button
            onClick={() => setSelectedBrand('gazelle')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedBrand === 'gazelle'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
            }`}
          >
            <span>🚚</span>
            <span>Газель</span>
          </button>

          <button
            onClick={() => setSelectedBrand('canter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedBrand === 'canter'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span>🚚</span>
            <span>Mitsubishi Canter</span>
          </button>

          <button
            onClick={() => setSelectedBrand('consumables')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedBrand === 'consumables'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span>🛢️</span>
            <span>Масла / ГСМ</span>
          </button>
        </div>
      </div>

      {/* ── ТАБЛИЦА ВАРИАНТА 3: ЭКСПРЕСС-ИНВЕНТАРИЗАЦИЯ ── */}
      <div className="bg-white border border-sky-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Шапка ведомости */}
        <div className="p-3.5 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-black text-sky-950 flex items-center gap-1.5">
              <span>📋</span>
              <span>Электронная ведомость инвентаризации склада</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Вносите реальный факт с полок склада — система сама рассчитает списания недостачи или
              оприходования
            </p>
          </div>
          {hasPendingChanges && (
            <div className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-1 rounded-lg animate-pulse">
              ⚠️ Не забудьте нажать «Сохранить пересчёт»
            </div>
          )}
        </div>

        {/* Табличная часть */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <div className="animate-spin text-3xl">⚙️</div>
              <p className="text-xs font-semibold">Загрузка номенклатуры и остатков...</p>
            </div>
          ) : parts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <span className="text-4xl">📦</span>
              <p className="text-sm font-bold text-slate-600">
                Запчастей в этой категории не найдено
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs font-bold text-sky-600 hover:underline"
              >
                + Добавить первую деталь
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Марка авто</th>
                  <th className="px-4 py-2.5">Наименование / Артикул</th>
                  <th className="px-4 py-2.5 text-center">В системе</th>
                  <th className="px-4 py-2.5 text-center">Факт на складе</th>
                  <th className="px-4 py-2.5 text-right">Закупка</th>
                  <th className="px-4 py-2.5 text-right">Клиенту (+30%)</th>
                  <th className="px-4 py-2.5 text-right">Сумма факт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parts.map((part) => {
                  const brandCfg =
                    part.category && BRAND_CONFIG[part.category]
                      ? BRAND_CONFIG[part.category]!
                      : BRAND_CONFIG.gazelle!;
                  const currentEffectiveStock =
                    (editedStocks[part.id] !== undefined ? editedStocks[part.id] : part.stock) ?? 0;
                  const diff = currentEffectiveStock - part.stock;
                  const isModified = editedStocks[part.id] !== undefined;

                  return (
                    <tr
                      key={part.id}
                      className={`transition-colors hover:bg-sky-50/30 ${
                        isModified ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Марка */}
                      <td className="px-4 py-2.5 align-middle">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-black text-[10px] border ${brandCfg.badgeClass}`}
                        >
                          <span>{brandCfg.icon}</span>
                          <span>{brandCfg.label}</span>
                        </span>
                      </td>

                      {/* Название и артикул */}
                      <td className="px-4 py-2.5 align-middle max-w-[280px]">
                        <div className="font-bold text-slate-900 truncate" title={part.name}>
                          {part.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {part.article || 'Без артикула'}
                        </div>
                      </td>

                      {/* В системе (расчётный остаток) */}
                      <td className="px-4 py-2.5 align-middle text-center font-bold text-slate-500">
                        <span>{part.stock}</span>{' '}
                        <span className="text-[10px] font-normal text-slate-400">
                          {part.unit || 'шт'}
                        </span>
                      </td>

                      {/* Факт на складе (инпут прямо в строке с кнопками +/-) */}
                      <td className="px-4 py-2.5 align-middle text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStockChange(part.id, currentEffectiveStock - 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center transition-all"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={currentEffectiveStock}
                            onChange={(e) =>
                              handleStockChange(part.id, parseInt(e.target.value) || 0)
                            }
                            className={`w-14 text-center font-black text-xs py-1 rounded-lg border transition-all ${
                              isModified
                                ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-300/40'
                                : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-sky-400'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleStockChange(part.id, currentEffectiveStock + 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center transition-all"
                          >
                            +
                          </button>
                          <span className="text-[10px] text-slate-400 w-6 text-left">
                            {part.unit || 'шт'}
                          </span>
                        </div>

                        {/* Индикатор разницы */}
                        {isModified && (
                          <div className="text-[10px] font-bold mt-0.5">
                            {diff > 0 && (
                              <span className="text-emerald-600 font-black">+{diff} излишек</span>
                            )}
                            {diff < 0 && (
                              <span className="text-rose-600 font-black">{diff} недостача</span>
                            )}
                            {diff === 0 && <span className="text-slate-400">без изменений</span>}
                          </div>
                        )}
                      </td>

                      {/* Цена закупки */}
                      <td className="px-4 py-2.5 align-middle text-right font-bold text-slate-700">
                        <Money amount={part.purchase_price} />
                      </td>

                      {/* Цена клиенту */}
                      <td className="px-4 py-2.5 align-middle text-right font-bold text-sky-700">
                        <Money amount={part.client_price} />
                      </td>

                      {/* Сумма склада */}
                      <td className="px-4 py-2.5 align-middle text-right font-black text-emerald-700">
                        <Money amount={currentEffectiveStock * part.purchase_price} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── МОДАЛЬНОЕ ОКНО: ДОБАВЛЕНИЕ НОВОЙ ЗАПЧАСТИ НА СКЛАД ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Шапка модалки */}
            <div className="px-5 py-4 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Добавить запчасть в номенклатуру
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Деталь будет сохранена в справочнике и автоматически оприходована на склад
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Тело формы */}
            <div className="p-5 space-y-4 text-xs">
              {/* Марка авто */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Марка автомобиля / категория *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'gazelle', label: '🚚 Газель' },
                      { id: 'valday', label: '🚛 Валдай' },
                      { id: 'canter', label: '🚚 Mitsubishi Canter' },
                      { id: 'consumables', label: '🛢️ Масла / ГСМ' },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setNewPartForm({ ...newPartForm, brand: b.id })}
                      className={`py-2 px-3 rounded-xl border text-left font-bold transition-all ${
                        newPartForm.brand === b.id
                          ? 'bg-sky-50 border-sky-400 text-sky-900 ring-2 ring-sky-200'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Название */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Наименование детали *</label>
                <input
                  type="text"
                  required
                  placeholder="Например: Ремень генератора 6PK1215 или Форсунка Bosch"
                  value={newPartForm.name}
                  onChange={(e) => setNewPartForm({ ...newPartForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 font-medium"
                />
              </div>

              {/* Артикул и Ед. изм. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Артикул / Каталожный №
                  </label>
                  <input
                    type="text"
                    placeholder="5320-1112010"
                    value={newPartForm.article}
                    onChange={(e) => setNewPartForm({ ...newPartForm, article: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Единица измерения</label>
                  <select
                    value={newPartForm.unit}
                    onChange={(e) => setNewPartForm({ ...newPartForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 font-medium"
                  >
                    <option value="шт">шт (штуки)</option>
                    <option value="л">л (литры)</option>
                    <option value="компл">компл (комплекты)</option>
                    <option value="кг">кг (килограммы)</option>
                    <option value="упак">упак (упаковки)</option>
                  </select>
                </div>
              </div>

              {/* Цены: Закупка и Клиенту */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Закупочная цена (₽) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPartForm.purchase_price}
                    onChange={(e) => {
                      const cost = parseFloat(e.target.value) || 0;
                      setNewPartForm({
                        ...newPartForm,
                        purchase_price: e.target.value,
                        // Авторасчёт +30% клиенту
                        client_price: Math.round(cost * 1.3).toString(),
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Цена клиенту (+30%)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPartForm.client_price}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, client_price: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-sky-800 font-bold"
                  />
                </div>
              </div>

              {/* Начальный остаток и Минимальный остаток */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Начальный остаток (факт)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPartForm.initial_stock}
                    onChange={(e) =>
                      setNewPartForm({ ...newPartForm, initial_stock: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-xl focus:bg-white focus:outline-hidden focus:border-emerald-500 text-emerald-900 font-black"
                  />
                  <span className="text-[10px] text-slate-400">Сразу оприходуется на склад</span>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Неснижаемый минимум</label>
                  <input
                    type="number"
                    min="0"
                    value={newPartForm.min_stock}
                    onChange={(e) => setNewPartForm({ ...newPartForm, min_stock: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:border-sky-400 text-slate-800 font-medium"
                  />
                  <span className="text-[10px] text-slate-400">Сигнал о дефиците</span>
                </div>
              </div>
            </div>

            {/* Подвал с кнопками */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newPartForm.name.trim() || createPartMutation.isPending}
                onClick={() => createPartMutation.mutate(newPartForm)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <span>{createPartMutation.isPending ? '⏳' : '✓'}</span>
                <span>{createPartMutation.isPending ? 'Создание...' : 'Сохранить на склад'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
