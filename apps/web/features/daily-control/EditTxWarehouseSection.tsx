'use client';

import type React from 'react';
import type { GaragePartOption, ModalWarehouseEntry } from './types';
import { detectBrandFromText, rub } from './utils';

const BRAND_OPTIONS = [
  { id: 'canter', label: '🚚 Canter', sub: 'Fuso' },
  { id: 'gazelle', label: '🚐 ГАЗель', sub: 'Next / Бизнес' },
  { id: 'valday', label: '🚛 Валдай', sub: 'ГАЗ-3310' },
  { id: 'consumables', label: '🛢️ ГСМ', sub: 'Масла' },
  { id: 'client', label: '🚗 Клиент', sub: 'Нива / др.' },
] as const;

export function EditTxWarehouseSection({
  txAmount,
  txDescription,
  whEnabled,
  setWhEnabled,
  whItems,
  setWhItems,
  warehouseParts,
}: {
  txAmount: number;
  txDescription: string;
  whEnabled: boolean;
  setWhEnabled: (v: boolean) => void;
  whItems: ModalWarehouseEntry[];
  setWhItems: React.Dispatch<React.SetStateAction<ModalWarehouseEntry[]>>;
  warehouseParts: GaragePartOption[];
}) {
  const totalWhSum = whItems.reduce(
    (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
    0,
  );
  const diff = txAmount - totalWhSum;

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        whEnabled
          ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100'
          : 'bg-slate-50/70 border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={whEnabled}
            onChange={(e) => {
              const checked = e.target.checked;
              setWhEnabled(checked);
              if (checked && whItems.length === 0) {
                setWhItems([
                  {
                    id: `wh-${Date.now()}`,
                    brand: detectBrandFromText(txDescription),
                    clientCarModel: '',
                    name: txDescription,
                    article: '',
                    quantity: 1,
                    unitPrice: txAmount,
                  },
                ]);
              }
            }}
            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 accent-sky-600 cursor-pointer"
          />
          <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
            <span>📦</span> Оприходовать на Склад запчастей (Гараж)
          </span>
        </label>
        {whEnabled && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-200/80 text-sky-900 border border-sky-300">
            {whItems.length} {whItems.length === 1 ? 'деталь' : 'детали(ей)'}
          </span>
        )}
      </div>

      {whEnabled && (
        <div className="mt-3 space-y-3 pt-3 border-t border-sky-200/60">
          <div className="bg-white/80 p-2.5 rounded-xl border border-sky-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">
                  Чек списания:
                </span>
                <span className="font-mono font-black text-rose-600 text-sm">{rub(txAmount)}</span>
              </div>
              <span className="text-slate-300 font-bold">→</span>
              <div>
                <span className="text-[10px] text-sky-700 uppercase font-bold block">
                  Итого на склад:
                </span>
                <span className="font-mono font-black text-sky-800 text-sm">{rub(totalWhSum)}</span>
              </div>
            </div>
            <div>
              {Math.abs(diff) < 0.01 ? (
                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span>✓</span>
                  <span>Сумма точно сходится</span>
                </span>
              ) : diff > 0 ? (
                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  <span>ℹ️</span>
                  <span>Остаток чека: {rub(diff)}</span>
                </span>
              ) : (
                <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Превышение: +{rub(Math.abs(diff))}</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {whItems.map((item, idx) => {
              const itemTotal = (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);
              return (
                <div
                  key={item.id}
                  className="bg-white p-3 rounded-xl border border-sky-200 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-800">Позиция #{idx + 1}</span>
                      <span className="text-[10px] font-mono font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {rub(itemTotal)}
                      </span>
                    </div>
                    {whItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setWhItems((prev) => prev.filter((p) => p.id !== item.id))}
                        className="text-slate-400 hover:text-rose-600 text-xs font-bold px-2 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                        title="Удалить эту позицию"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                      Марка / Автомобиль: *
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
                      {BRAND_OPTIONS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setWhItems((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? {
                                      ...p,
                                      brand: b.id,
                                      clientCarModel:
                                        b.id === 'client' && !p.clientCarModel
                                          ? 'Нива'
                                          : p.clientCarModel,
                                    }
                                  : p,
                              ),
                            )
                          }
                          className={`p-1.5 rounded-lg text-left border text-xs font-bold transition cursor-pointer ${
                            item.brand === b.id
                              ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-sky-50'
                          }`}
                        >
                          <div className="font-black text-[11px] leading-tight">{b.label}</div>
                          <div
                            className={`text-[8px] leading-tight ${
                              item.brand === b.id ? 'text-sky-100' : 'text-slate-400'
                            }`}
                          >
                            {b.sub}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.brand === 'client' && (
                    <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="text-[10px] font-black uppercase text-purple-900 tracking-wider block mb-1">
                        🚗 Марка / модель клиентского авто:
                      </label>
                      <input
                        type="text"
                        value={item.clientCarModel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWhItems((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, clientCarModel: val } : p)),
                          );
                        }}
                        placeholder="Например: Нива 2121, Нива Шевроле, Ford Transit, УАЗ Патриот"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-md font-bold text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Наименование детали: *
                      </label>
                      <input
                        type="text"
                        list={`warehouse-suggestions-${item.id}`}
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = warehouseParts.find(
                            (p) => p.name.toLowerCase() === val.toLowerCase(),
                          );
                          setWhItems((prev) =>
                            prev.map((p) =>
                              p.id === item.id
                                ? {
                                    ...p,
                                    name: val,
                                    brand: matched?.category || p.brand,
                                    article: matched?.article || p.article,
                                  }
                                : p,
                            ),
                          );
                        }}
                        placeholder={
                          item.brand === 'canter'
                            ? 'Ремень генератора Fuso Canter'
                            : item.brand === 'gazelle'
                              ? 'Колодки тормозные передние Газель'
                              : item.brand === 'valday'
                                ? 'Фильтр воздушный Валдай'
                                : item.brand === 'client'
                                  ? 'Тормозные колодки Нива'
                                  : 'Масло моторное 10W-40'
                        }
                        className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                      <datalist id={`warehouse-suggestions-${item.id}`}>
                        {warehouseParts
                          .filter(
                            (p) => item.brand === 'all' || !p.category || p.category === item.brand,
                          )
                          .map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.article ? `[${p.article}] ` : ''}
                              {p.name}
                            </option>
                          ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Артикул (OEM):
                      </label>
                      <input
                        type="text"
                        value={item.article}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWhItems((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, article: val } : p)),
                          );
                        }}
                        placeholder="ME221833"
                        className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Количество (шт):
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const q = Math.max(1, parseInt(e.target.value) || 1);
                          setWhItems((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, quantity: q } : p)),
                          );
                        }}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Цена за шт (₽):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? ''
                              : Math.max(0, parseFloat(e.target.value) || 0);
                          setWhItems((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, unitPrice: val } : p)),
                          );
                        }}
                        className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
                        Сумма строки:
                      </label>
                      <div className="mt-1 px-2.5 py-1.5 text-xs font-mono font-black text-sky-800 bg-sky-50 border border-sky-300 rounded-lg flex items-center justify-between">
                        <span>{rub(itemTotal)}</span>
                        <span className="text-[9px] text-sky-600 font-sans">
                          ({item.quantity} шт)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const currentTotal = whItems.reduce(
                (acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                0,
              );
              const remaining = Math.max(0, txAmount - currentTotal);
              setWhItems((prev) => [
                ...prev,
                {
                  id: `wh-${Date.now()}-${Math.random()}`,
                  brand: 'canter',
                  clientCarModel: '',
                  name: '',
                  article: '',
                  quantity: 1,
                  unitPrice: remaining > 0 ? remaining : '',
                },
              ]);
            }}
            className="w-full py-2 px-3 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-100/60 text-sky-800 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>➕</span>
            <span>Добавить ещё деталь в эту накладную</span>
          </button>

          <div className="text-[10px] text-sky-900 bg-sky-100/60 p-2.5 rounded-xl border border-sky-200 leading-relaxed flex items-center justify-between">
            <div>
              💡 Все добавленные детали поступят на склад в соответствующие разделы автопарка и
              клиентов.
            </div>
            <a
              href="/garage?tab=warehouse"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-sky-700 hover:text-sky-900 font-bold underline whitespace-nowrap ml-2"
            >
              Склад ТМЦ ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
