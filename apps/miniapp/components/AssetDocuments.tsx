'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface AssetDocItem {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number | null;
  is_pass_package: boolean;
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function AssetDocuments({ assetId }: { assetId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const queryKey = ['miniapp-asset-documents', assetId];

  const {
    data: documents = [],
    isLoading: loading,
    error: loadError,
  } = useQuery<AssetDocItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/asset-documents/list?assetId=${encodeURIComponent(assetId)}`,
      );
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Не удалось загрузить документы');
      }
      const data = (await res.json()) as AssetDocItem[];
      return Array.isArray(data) ? data : [];
    },
  });

  const error = actionError ?? (loadError instanceof Error ? loadError.message : null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setActionError('Файл больше 10 МБ');
      return;
    }

    setUploading(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', assetId);
      formData.append('isPassPackage', 'true');

      const res = await fetch('/api/admin/asset-documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Ошибка загрузки');
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey }),
        qc.invalidateQueries({ queryKey: ['miniapp-admin-assets'] }),
      ]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      const res = await fetch(
        `/api/admin/asset-documents/url?id=${encodeURIComponent(id)}&expiresIn=120`,
      );
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Ошибка получения ссылки');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка открытия');
    }
  };

  const handleTogglePass = async (doc: AssetDocItem) => {
    setTogglingId(doc.id);
    setActionError(null);
    try {
      const res = await fetch('/api/admin/asset-documents/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, isPassPackage: !doc.is_pass_package }),
      });
      if (!res.ok) throw new Error('Не удалось обновить');
      const updated = (await res.json()) as AssetDocItem;
      qc.setQueryData<AssetDocItem[]>(queryKey, (prev = []) =>
        prev.map((d) => (d.id === doc.id ? updated : d)),
      );
      void qc.invalidateQueries({ queryKey: ['miniapp-admin-assets'] });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка обновления');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить документ?')) return;
    setActionError(null);
    try {
      const res = await fetch('/api/admin/asset-documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Не удалось удалить');
      qc.setQueryData<AssetDocItem[]>(queryKey, (prev = []) => prev.filter((d) => d.id !== id));
      void qc.invalidateQueries({ queryKey: ['miniapp-admin-assets'] });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  return (
    <div className="pt-3 border-t border-[#E7E8EA] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex-1 bg-[#F6F7F8] border border-[#DFE1E5] text-[#111111] text-xs font-bold text-center px-3 py-2 rounded-xl cursor-pointer">
          {uploading ? 'Загрузка...' : '+ Файл (СТС, ОСАГО, DOCX)'}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
        <Link
          href={`/admin/send-docs?assetId=${encodeURIComponent(assetId)}`}
          className="text-xs font-bold px-3 py-2 rounded-xl bg-[#FFDD2D] text-[#111111] shrink-0"
        >
          На пропуск →
        </Link>
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-[#666B73]">Загрузка документов...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-[#666B73]">Документов пока нет (JPG, PNG, PDF, DOCX до 10 МБ)</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="bg-[#F6F7F8] px-2.5 py-2 rounded-xl border border-[#E7E8EA] flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-white text-[#22252A] border border-[#E2E4E8] shrink-0">
                  {doc.file_type}
                </span>
                <span className="text-xs font-semibold text-[#111111] truncate">
                  {doc.file_name}
                </span>
                {doc.file_size_bytes ? (
                  <span className="text-[10px] text-[#666B73] shrink-0">
                    {formatSize(doc.file_size_bytes)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={togglingId === doc.id}
                  onClick={() => handleTogglePass(doc)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${
                    doc.is_pass_package
                      ? 'bg-[#FFFDF0] border-[#F2D544] text-[#111111]'
                      : 'bg-white border-[#E2E4E8] text-[#666B73]'
                  }`}
                >
                  {doc.is_pass_package ? '✓ Пропуск' : 'Скрыт'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(doc.id)}
                  className="text-[10px] font-semibold bg-white border border-[#E2E4E8] px-2 py-1 rounded-lg text-[#111111]"
                >
                  Открыть
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="text-xs font-bold text-rose-500 px-1.5 py-0.5"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
