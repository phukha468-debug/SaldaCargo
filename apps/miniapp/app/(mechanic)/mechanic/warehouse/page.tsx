'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@saldacargo/ui';

interface Part {
  id: string;
  name: string;
  article: string | null;
  stock: number;
  unit: string;
  min_stock: number | null;
}

export default function WarehousePage() {
  const [search, setSearch] = useState('');

  const { data: parts, isLoading } = useQuery<Part[]>({
    queryKey: ['parts', search],
    queryFn: async () => {
      const res = await fetch(`/api/mechanic/parts?search=${search}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      return res.json();
    },
  });

  return (
    <div className="flex flex-col min-h-full">
      <div className="bg-white p-4 border-b border-slate-200 sticky top-16 z-40">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">🔍</span>
          <input
            type="text"
            placeholder="Поиск по названию или артикулу..."
            className="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />)
        ) : (parts ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-bold">Ничего не найдено</div>
        ) : (
          parts?.map((part) => (
            <div key={part.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">{part.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Арт: {part.article || '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900">{part.stock || 0} <span className="text-[10px] font-bold text-slate-400 uppercase">{part.unit}</span></p>
                <p className={cn("text-[9px] font-black uppercase", (part.stock || 0) <= (part.min_stock || 0) ? "text-red-500" : "text-green-500")}>
                  {(part.stock || 0) <= (part.min_stock || 0) ? "Мало" : "В наличии"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
