'use client';

export interface EditableGarageWork {
  name: string;
  minutes: string;
  notes?: string;
  performer: 'both' | 'primary' | 'second';
  mechanic_id?: string | null;
  second_mechanic_id?: string | null;
}

export interface EditableGaragePart {
  name: string;
  quantity: string;
  unit: string;
  unit_price: string;
  client_price: string;
}

export function GarageOrderWorksPartsEditor({
  works,
  setWorks,
  parts,
  setParts,
  assignedMechanicId,
  secondMechanicId,
  primaryMechName,
  secondMechName,
  calcWorkPayShares,
  totalPartsCost,
  totalPartsClient,
  totalPartsMargin,
}: {
  works: EditableGarageWork[];
  setWorks: React.Dispatch<React.SetStateAction<EditableGarageWork[]>>;
  parts: EditableGaragePart[];
  setParts: React.Dispatch<React.SetStateAction<EditableGaragePart[]>>;
  assignedMechanicId: string;
  secondMechanicId: string;
  primaryMechName: string;
  secondMechName: string;
  calcWorkPayShares: (w: EditableGarageWork) => { price: number; pay1: number; pay2: number };
  totalPartsCost: number;
  totalPartsClient: number;
  totalPartsMargin: number;
}) {
  return (
    <>
      {/* Работы (строго компактный Dense 1-Line Layout) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-400">
            Перечень работ ({works.length})
          </span>
          <button
            type="button"
            onClick={() =>
              setWorks((prev) => [
                ...prev,
                {
                  name: '',
                  minutes: '30',
                  performer: secondMechanicId ? 'both' : 'primary',
                  mechanic_id: assignedMechanicId || null,
                  second_mechanic_id: secondMechanicId || null,
                },
              ])
            }
            className="text-xs font-black text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            + Добавить работу
          </button>
        </div>
        {works.map((w, idx) => {
          const shares = calcWorkPayShares(w);
          return (
            <div
              key={idx}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-2"
            >
              <span className="text-xs font-black text-slate-400 shrink-0">{idx + 1}.</span>
              <input
                type="text"
                value={w.name}
                onChange={(e) =>
                  setWorks((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                  )
                }
                placeholder="Наименование работы"
                className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
              />
              {secondMechanicId && (
                <select
                  value={w.performer}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) =>
                        i === idx
                          ? {
                              ...item,
                              performer: e.target.value as 'both' | 'primary' | 'second',
                            }
                          : item,
                      ),
                    )
                  }
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 shrink-0"
                >
                  <option value="both">👥 Вдвоём 50/50</option>
                  <option value="primary">👤 {primaryMechName.split(' ')[0]}</option>
                  <option value="second">👤 {secondMechName.split(' ')[0]}</option>
                </select>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={w.minutes}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, minutes: e.target.value } : item,
                      ),
                    )
                  }
                  className="w-16 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs font-black text-center"
                />
                <span className="text-[10px] text-slate-400 font-bold">мин</span>
              </div>
              <span
                className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-1 rounded-lg shrink-0 whitespace-nowrap"
                title={
                  secondMechanicId && w.performer === 'both'
                    ? `${primaryMechName.split(' ')[0]}: ${Math.round(shares.pay1)} ₽ + ${secondMechName.split(' ')[0]}: ${Math.round(shares.pay2)} ₽`
                    : undefined
                }
              >
                {Math.round(shares.pay1 + shares.pay2)} ₽
              </span>
              {works.length > 1 && (
                <button
                  type="button"
                  onClick={() => setWorks((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:text-rose-700 text-sm font-black px-1 cursor-pointer shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Запчасти с двумя графами (закупка + продажа клиенту с кнопкой +30%) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-slate-400">
            Запчасти автосервиса ({parts.length})
          </span>
          <button
            type="button"
            onClick={() =>
              setParts((prev) => [
                ...prev,
                { name: '', quantity: '1', unit: 'шт', unit_price: '', client_price: '' },
              ])
            }
            className="text-xs font-black text-emerald-600 hover:text-emerald-700 cursor-pointer"
          >
            + Добавить запчасть
          </button>
        </div>

        {parts.map((p, idx) => {
          const uPrice = parseFloat(p.unit_price) || 0;
          const cPrice = parseFloat(p.client_price) || 0;
          const qty = parseFloat(p.quantity) || 1;
          const margin = Math.max(0, (cPrice - uPrice) * qty);

          return (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400">{idx + 1}.</span>
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) =>
                    setParts((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)),
                    )
                  }
                  placeholder="Название запчасти (колодки, фильтр...)"
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={p.quantity}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, quantity: e.target.value } : item,
                        ),
                      )
                    }
                    className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center"
                  />
                  <input
                    type="text"
                    value={p.unit}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, unit: e.target.value } : item,
                        ),
                      )
                    }
                    className="w-12 bg-white border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs font-bold text-center"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setParts((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:text-rose-700 text-sm font-black px-1.5 cursor-pointer"
                  title="Удалить позицию"
                >
                  ✕
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs pt-1 border-t border-slate-200/70">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-500 whitespace-nowrap">Купили за:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={p.unit_price}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParts((prev) =>
                        prev.map((item, i) => {
                          if (i !== idx) return item;
                          const num = parseFloat(val) || 0;
                          return {
                            ...item,
                            unit_price: val,
                            client_price:
                              item.client_price || (num > 0 ? String(Math.round(num * 1.3)) : ''),
                          };
                        }),
                      );
                    }}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-right"
                  />
                  <span className="text-slate-400">₽</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const cost = parseFloat(p.unit_price) || 0;
                    if (cost > 0) {
                      const standardPrice = Math.round(cost * 1.3);
                      setParts((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, client_price: String(standardPrice) } : item,
                        ),
                      );
                    }
                  }}
                  title="Стандартная накрутка СТО +30%"
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-black text-[11px] cursor-pointer transition-colors shadow-2xs"
                >
                  +30%
                </button>

                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700 whitespace-nowrap">Клиенту:</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={p.client_price}
                    onChange={(e) =>
                      setParts((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, client_price: e.target.value } : item,
                        ),
                      )
                    }
                    className="w-24 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-sm font-bold text-right text-emerald-900"
                  />
                  <span className="text-slate-400">₽</span>
                </div>

                {cPrice > uPrice && uPrice > 0 && (
                  <div className="ml-auto text-[11px] font-black text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    Заработок СТО: +{Math.round(margin).toLocaleString('ru-RU')} ₽ (
                    {Math.round(((cPrice - uPrice) / uPrice) * 100)}%)
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {parts.length > 0 && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-emerald-50/50 border border-emerald-200/80 rounded-xl px-3.5 py-2">
            <span>
              Закупка:{' '}
              <span className="text-slate-900 font-black">
                {Math.round(totalPartsCost).toLocaleString('ru-RU')} ₽
              </span>
            </span>
            <span>
              Клиенту:{' '}
              <span className="text-slate-900 font-black">
                {Math.round(totalPartsClient).toLocaleString('ru-RU')} ₽
              </span>
            </span>
            <span className="text-emerald-700 font-black">
              Заработок на з/ч: +{Math.round(totalPartsMargin).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        )}
      </div>
    </>
  );
}
