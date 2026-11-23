'use client';

import { useState } from 'react';
import type { OrderDetailPart } from '../../types';

export function OrderDetailPartsSection({
  parts,
  showAddPart,
  setShowAddPart,
  addPartPending,
  addPartError,
  onAddPart,
  onPatchPart,
  deletePartPending,
  onDeletePart,
}: {
  parts: OrderDetailPart[];
  showAddPart: boolean;
  setShowAddPart: (v: boolean) => void;
  addPartPending: boolean;
  addPartError: string | null;
  onAddPart: (body: {
    custom_part_name: string;
    quantity: number;
    unit_price?: string;
    client_price?: string;
  }) => void;
  onPatchPart: (body: { partId: string; client_price?: string; unit_price?: string }) => void;
  deletePartPending: boolean;
  onDeletePart: (partId: string) => void;
}) {
  const [partPricesDraft, setPartPricesDraft] = useState<Record<string, string>>({});
  const [partUnitPricesDraft, setPartUnitPricesDraft] = useState<Record<string, string>>({});
  const [addPartName, setAddPartName] = useState('');
  const [addPartQty, setAddPartQty] = useState(1);
  const [addPartCost, setAddPartCost] = useState('');
  const [addPartPrice, setAddPartPrice] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || addPartError;

  const totalCost = parts.reduce(
    (s, p) => s + (parseFloat(p.unit_price ?? '0') || 0) * (p.quantity ?? 1),
    0,
  );
  const totalClient = parts.reduce(
    (s, p) => s + (parseFloat(p.client_price ?? '0') || 0) * (p.quantity ?? 1),
    0,
  );
  const totalMargin = Math.max(0, totalClient - totalCost);

  return (
    <div className={parts.length === 0 && !showAddPart ? 'mb-2' : 'mb-0'}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500 font-semibold uppercase">
            Запчасти ({parts.length})
          </p>
          {parts.length > 0 && (
            <p className="text-[10px] text-slate-400 italic hidden sm:block">
              — цена пустая = запчасть клиента
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAddPart(!showAddPart)}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
        >
          {showAddPart ? '✕ Закрыть' : '+ Добавить'}
        </button>
      </div>

      {showAddPart && (
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex gap-2 items-center flex-wrap">
            <input
              autoFocus
              type="text"
              value={addPartName}
              onChange={(e) => {
                setAddPartName(e.target.value);
                setLocalError(null);
              }}
              placeholder="Название запчасти..."
              className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none min-w-[160px] font-bold"
            />
            <div className="flex items-center gap-1 shrink-0 border border-slate-300 rounded-lg overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setAddPartQty((q) => Math.max(1, q - 1))}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
              >
                −
              </button>
              <span className="px-1 text-sm font-bold text-slate-800 min-w-[20px] text-center">
                {addPartQty}
              </span>
              <button
                type="button"
                onClick={() => setAddPartQty((q) => q + 1)}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 text-sm font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-slate-200">
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-500">Закупка:</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={addPartCost}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddPartCost(val);
                  const num = parseFloat(val) || 0;
                  if (num > 0 && !addPartPrice) {
                    setAddPartPrice(String(Math.round(num * 1.3)));
                  }
                }}
                className="w-20 text-xs bg-white border border-slate-200 rounded px-2 py-1 outline-none font-bold text-right"
              />
              <span className="text-slate-400">₽</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const cost = parseFloat(addPartCost) || 0;
                if (cost > 0) {
                  setAddPartPrice(String(Math.round(cost * 1.3)));
                }
              }}
              title="Наценка +30%"
              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-black text-[11px] cursor-pointer transition-colors shadow-2xs"
            >
              +30%
            </button>

            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-700">Клиенту:</span>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={addPartPrice}
                onChange={(e) => setAddPartPrice(e.target.value)}
                className="w-20 text-xs bg-white border border-emerald-300 rounded px-2 py-1 outline-none font-bold text-right text-emerald-900"
              />
              <span className="text-slate-400">₽</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!addPartName.trim()) {
                  setLocalError('Введите название');
                  return;
                }
                onAddPart({
                  custom_part_name: addPartName,
                  unit_price: addPartCost || undefined,
                  client_price: addPartPrice || addPartCost || undefined,
                  quantity: addPartQty,
                });
                setAddPartName('');
                setAddPartQty(1);
                setAddPartCost('');
                setAddPartPrice('');
              }}
              disabled={addPartPending}
              className="ml-auto text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 shrink-0 cursor-pointer"
            >
              Добавить
            </button>
          </div>

          {displayError && <p className="text-xs text-red-600 font-medium">{displayError}</p>}
        </div>
      )}

      {parts.length > 0 && (
        <>
          <div className="space-y-1.5">
            {parts.map((p) => {
              const partName = p.part?.name ?? p.custom_part_name ?? '—';
              const partUnit = p.part?.unit ?? p.unit ?? 'шт';
              const savedClientPrice = parseFloat(p.client_price ?? '0');
              const savedUnitPrice = parseFloat(p.unit_price ?? '0');
              const draftClient =
                partPricesDraft[p.id] ??
                (savedClientPrice > 0 ? String(Math.round(savedClientPrice)) : '');
              const draftUnit =
                partUnitPricesDraft[p.id] ?? (p.unit_price ? String(p.unit_price) : '');
              const margin = Math.max(0, (savedClientPrice - savedUnitPrice) * (p.quantity || 1));

              return (
                <div
                  key={p.id}
                  className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 flex items-center justify-between gap-3 group text-xs"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="font-bold text-slate-800 truncate">{partName}</span>
                    <span className="text-slate-500 font-semibold shrink-0">
                      {p.quantity} {partUnit}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Закупка */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Закупка:
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={draftUnit}
                        onChange={(e) =>
                          setPartUnitPricesDraft((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const newVal = parseFloat(draftUnit || '0');
                          if (Math.abs(newVal - savedUnitPrice) > 0.01) {
                            onPatchPart({ partId: p.id, unit_price: newVal.toFixed(2) });
                          }
                        }}
                        placeholder="0.00"
                        className="w-16 text-right text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white font-bold"
                      />
                      <span className="text-slate-400">₽</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const cost = parseFloat(draftUnit || String(savedUnitPrice)) || 0;
                        if (cost > 0) {
                          const cPrice = Math.round(cost * 1.3).toFixed(2);
                          setPartPricesDraft((prev) => ({ ...prev, [p.id]: cPrice }));
                          onPatchPart({ partId: p.id, client_price: cPrice });
                        }
                      }}
                      title="Рассчитать цену клиенту с накруткой +30%"
                      className="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-black text-[10px] cursor-pointer"
                    >
                      +30%
                    </button>

                    {/* Клиенту */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        Клиенту:
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={draftClient}
                        onChange={(e) =>
                          setPartPricesDraft((prev) => ({
                            ...prev,
                            [p.id]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const newVal = parseFloat(draftClient || '0');
                          if (Math.abs(newVal - savedClientPrice) > 0.01) {
                            onPatchPart({ partId: p.id, client_price: newVal.toFixed(2) });
                          }
                        }}
                        placeholder="0.00"
                        className="w-18 text-right text-xs border border-emerald-300 rounded px-1.5 py-0.5 bg-white font-bold text-emerald-900"
                      />
                      <span className="text-slate-400">₽</span>
                    </div>

                    {margin > 0 && (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        +{Math.round(margin).toLocaleString('ru-RU')} ₽
                      </span>
                    )}

                    <button
                      onClick={() => onDeletePart(p.id)}
                      disabled={deletePartPending}
                      className="ml-1 text-slate-300 hover:text-rose-500 opacity-60 group-hover:opacity-100 transition-opacity font-bold"
                      title="Удалить"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-emerald-50/50 border border-emerald-200/80 rounded-xl px-3 py-1.5 font-bold">
            <span>
              Закупка:{' '}
              <span className="text-slate-900 font-black">
                {totalCost.toLocaleString('ru-RU')} ₽
              </span>
            </span>
            <span>
              Клиенту:{' '}
              <span className="text-slate-900 font-black">
                {totalClient.toLocaleString('ru-RU')} ₽
              </span>
            </span>
            <span className="text-emerald-700 font-black">
              Заработок на з/ч: +{totalMargin.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </>
      )}
    </div>
  );
}
