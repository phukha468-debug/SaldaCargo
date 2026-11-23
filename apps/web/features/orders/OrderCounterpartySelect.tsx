'use client';

import { useRef, useState } from 'react';
import type { OrderCounterpartyOption } from './types';
import { normalizeCounterpartySearch } from './utils';

export function OrderCounterpartySelect({
  inputValue,
  counterparties,
  onChange,
}: {
  inputValue: string;
  counterparties: OrderCounterpartyOption[];
  onChange: (cp: OrderCounterpartyOption | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(inputValue);
  const [prevInputValue, setPrevInputValue] = useState(inputValue);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (inputValue !== prevInputValue) {
    setPrevInputValue(inputValue);
    setQuery(inputValue);
  }

  const qTrim = query.trim();
  const qLower = qTrim.toLowerCase();
  const qNorm = normalizeCounterpartySearch(qTrim);

  const filtered = qTrim
    ? counterparties.filter((c) => {
        if (!c?.name) return false;
        const nameLower = c.name.toLowerCase();
        const nameNorm = normalizeCounterpartySearch(c.name);
        const innStr = c.inn ? String(c.inn) : '';
        return (
          nameLower.includes(qLower) ||
          (qNorm.length > 1 && nameNorm.includes(qNorm)) ||
          (innStr && innStr.includes(qTrim))
        );
      })
    : counterparties;

  const exactMatch = counterparties.find((c) => {
    if (!c?.name) return false;
    const nameLower = c.name.toLowerCase().trim();
    const nameNorm = normalizeCounterpartySearch(c.name);
    return nameLower === qLower || (qNorm.length > 2 && nameNorm === qNorm);
  });

  const handleSelect = (cp: OrderCounterpartyOption) => {
    setQuery(cp.name);
    setOpen(false);
    onChange(cp, cp.name);
  };

  const handleClear = () => {
    setQuery('');
    setOpen(false);
    onChange(null, '');
  };

  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input
          type="text"
          required
          className={`w-full border rounded pl-7 pr-7 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs transition ${
            !query.trim()
              ? 'border-amber-400 bg-amber-50/50 text-slate-800 placeholder:text-amber-700/60'
              : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
          }`}
          value={query}
          placeholder="⚠️ Выберите заказчика из списка или начните ввод..."
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setOpen(true);
            const valTrim = val.trim();
            if (!valTrim) {
              onChange(null, '');
            } else {
              const valLower = valTrim.toLowerCase();
              const valNorm = normalizeCounterpartySearch(valTrim);
              const matched = counterparties.find((c) => {
                if (!c?.name) return false;
                const nameLower = c.name.toLowerCase().trim();
                const nameNorm = normalizeCounterpartySearch(c.name);
                return nameLower === valLower || (valNorm.length > 2 && nameNorm === valNorm);
              });
              onChange(matched || null, val);
            }
          }}
        />
        <span className="absolute left-2 text-slate-400 pointer-events-none text-xs">🔍</span>
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="absolute right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer transition"
          >
            ×
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || (query.trim() && !exactMatch)) && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs"
        >
          {filtered.slice(0, 50).map((cp) => (
            <button
              key={cp.id}
              type="button"
              onClick={() => handleSelect(cp)}
              className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-900 flex items-center justify-between transition cursor-pointer border-b border-slate-50 last:border-0"
            >
              <span className="font-semibold text-slate-800 truncate pr-2">{cp.name}</span>
              {cp.inn && (
                <span className="shrink-0 text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                  ИНН {cp.inn}
                </span>
              )}
            </button>
          ))}

          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onChange(null, query.trim());
              }}
              className="w-full text-left px-3 py-2 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1.5 transition cursor-pointer border-t border-indigo-100"
            >
              <span>➕ Использовать:</span>
              <span className="italic truncate font-semibold">«{query.trim()}»</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
