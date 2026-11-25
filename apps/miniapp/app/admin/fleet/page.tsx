'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AssetDocuments } from '@/components/AssetDocuments';

interface MiniappAssetItem {
  id: string;
  short_name: string | null;
  reg_number: string | null;
  status: string | null;
  docs_count: number;
  pass_docs_count: number;
}

export default function AdminFleetPage() {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: assets = [],
    isLoading,
    error,
  } = useQuery<MiniappAssetItem[]>({
    queryKey: ['miniapp-admin-assets'],
    queryFn: async () => {
      const res = await fetch('/api/admin/assets');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Не удалось загрузить автопарк');
      }
      const json = (await res.json()) as MiniappAssetItem[];
      return Array.isArray(json) ? json : [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const name = (a.short_name ?? '').toLowerCase();
      const plate = (a.reg_number ?? '').toLowerCase();
      return name.includes(q) || plate.includes(q);
    });
  }, [assets, search]);

  return (
    <div className="min-h-screen bg-[#F6F7F8] px-3 pt-4 pb-6 max-w-lg mx-auto space-y-3">
      {/* Компактная шапка в 1 строку */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-lg font-extrabold text-[#111111] truncate">Парк</h1>
          <span className="text-xs font-bold text-[#666B73] shrink-0">{assets.length} ТС</span>
        </div>
        <Link
          href="/admin/send-docs"
          className="px-3 py-1.5 rounded-xl bg-[#FFDD2D] text-[#111111] text-xs font-extrabold shrink-0"
        >
          Отправить документы →
        </Link>
      </div>

      {/* Быстрый поиск */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по госномеру или названию..."
        className="w-full bg-white border border-[#E7E8EA] rounded-[14px] px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-[#8E949E] focus:outline-none focus:border-[#111111]"
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-[16px] px-3.5 py-2.5">
          {error instanceof Error ? error.message : 'Ошибка загрузки'}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white border border-[#E7E8EA] rounded-[18px] p-4 text-center text-xs text-[#666B73]">
          Загрузка автопарка...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E7E8EA] rounded-[18px] p-4 text-center text-xs text-[#666B73]">
          Техника не найдена
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((asset) => {
            const isOpen = expandedId === asset.id;
            const title = asset.short_name?.trim() || asset.reg_number?.trim() || 'Без названия';
            const showPlate =
              Boolean(asset.reg_number?.trim()) &&
              asset.reg_number?.trim() !== asset.short_name?.trim();

            return (
              <div
                key={asset.id}
                className="bg-white border border-[#E7E8EA] rounded-[18px] px-3.5 py-2.5 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : asset.id)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex items-center gap-2 flex-1">
                    {showPlate && (
                      <span className="text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-lg bg-[#F6F7F8] border border-[#E2E4E8] text-[#111111] shrink-0">
                        {asset.reg_number}
                      </span>
                    )}
                    <span className="text-sm font-bold text-[#111111] truncate">{title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        asset.docs_count > 0
                          ? 'bg-[#FFFDF0] border-[#F2D544] text-[#111111]'
                          : 'bg-[#F6F7F8] border-[#E7E8EA] text-[#8E949E]'
                      }`}
                    >
                      {asset.docs_count > 0 ? `📄 ${asset.docs_count}` : '0 док.'}
                    </span>
                    <span className="text-xs text-[#666B73] w-4 text-center">
                      {isOpen ? '▴' : '▾'}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-2.5">
                    <AssetDocuments assetId={asset.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
