'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface EntityDocumentItem {
  id: string;
  entity_id: string;
  entity_kind: 'driver' | 'asset';
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number | null;
  is_pass_package: boolean;
  created_at: string | null;
}

interface EntityDocumentsSectionProps {
  entityKind: 'driver' | 'asset';
  entityId: string;
  title?: string;
}

function formatSizeMb(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function EntityDocumentsSection({
  entityKind,
  entityId,
  title,
}: EntityDocumentsSectionProps) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const apiBase = entityKind === 'driver' ? '/api/driver-documents' : '/api/asset-documents';
  const idParam = entityKind === 'driver' ? 'driverId' : 'assetId';
  const queryKey = ['entity-documents', entityKind, entityId];

  const {
    data: documents = [],
    isLoading: loading,
    error: loadError,
  } = useQuery<EntityDocumentItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`${apiBase}/list?${idParam}=${encodeURIComponent(entityId)}`);
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Не удалось загрузить список документов');
      }
      const data = (await res.json()) as EntityDocumentItem[];
      return Array.isArray(data) ? data : [];
    },
  });

  const error = actionError ?? (loadError instanceof Error ? loadError.message : null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setActionError('Размер файла превышает 10 МБ');
      return;
    }

    setUploading(true);
    setActionError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append(idParam, entityId);
      formData.append('isPassPackage', 'true');

      const res = await fetch(`${apiBase}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Ошибка загрузки файла');
      }
      await qc.invalidateQueries({ queryKey });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/url?id=${encodeURIComponent(id)}&expiresIn=120`);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Не удалось получить ссылку');
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка открытия файла');
    }
  };

  const handleTogglePass = async (doc: EntityDocumentItem) => {
    setTogglingId(doc.id);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, isPassPackage: !doc.is_pass_package }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Не удалось обновить статус документа');
      }
      const updated = (await res.json()) as EntityDocumentItem;
      qc.setQueryData<EntityDocumentItem[]>(queryKey, (prev = []) =>
        prev.map((d) => (d.id === doc.id ? updated : d)),
      );
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
      const res = await fetch(`${apiBase}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Не удалось удалить документ');
      }
      qc.setQueryData<EntityDocumentItem[]>(queryKey, (prev = []) =>
        prev.filter((d) => d.id !== id),
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const sendHref =
    entityKind === 'driver'
      ? `/send-docs?driverId=${encodeURIComponent(entityId)}`
      : `/send-docs?assetId=${encodeURIComponent(entityId)}`;

  return (
    <div className="mt-4 pt-4 border-t border-[#E7E8EA] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-extrabold text-[#111111]">
          {title ?? (entityKind === 'driver' ? 'Документы водителя' : 'Документы ТС')}
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href={sendHref}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#FFDD2D] hover:bg-[#FCC521] text-[#111111] transition-colors"
          >
            Отправить на пропуск →
          </Link>
          <label className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#F2F3F5] hover:bg-[#E5E7EB] text-[#111111] cursor-pointer transition-colors">
            {uploading ? 'Загрузка...' : '+ Файл (JPG, PNG, PDF, DOCX)'}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#666B73]">Загрузка документов...</p>
      ) : documents.length === 0 ? (
        <p className="text-xs text-[#666B73] bg-[#F6F7F8] rounded-xl px-3 py-2 border border-[#E7E8EA]">
          Документов пока нет. Загрузите сканы (СТС, паспорт, ВУ, заявку .docx) до 10 МБ.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-[#E7E8EA]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#22252A] border border-[#E2E4E8] shrink-0">
                  {doc.file_type}
                </span>
                <span
                  className="text-xs font-semibold text-[#111111] truncate"
                  title={doc.file_name}
                >
                  {doc.file_name}
                </span>
                {doc.file_size_bytes ? (
                  <span className="text-[10px] text-[#666B73] shrink-0">
                    {formatSizeMb(doc.file_size_bytes)}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={togglingId === doc.id}
                  onClick={() => handleTogglePass(doc)}
                  title="Включать в пакет для пропуска по умолчанию"
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                    doc.is_pass_package
                      ? 'bg-[#FFFDF0] border-[#F2D544] text-[#111111]'
                      : 'bg-[#F6F7F8] border-[#E2E4E8] text-[#666B73]'
                  }`}
                >
                  {doc.is_pass_package ? '✓ Для пропуска' : 'Не в пакете'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(doc.id)}
                  className="text-[10px] font-semibold bg-[#F6F7F8] hover:bg-[#EAECEF] border border-[#E2E4E8] px-2 py-1 rounded-lg text-[#111111] transition-colors"
                >
                  Открыть
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  title="Удалить документ"
                  className="text-xs font-bold text-[#666B73] hover:text-rose-600 px-1.5 py-0.5"
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
