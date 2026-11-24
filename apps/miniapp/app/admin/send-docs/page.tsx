'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { EntityDocumentRecord, PassSendBootstrapData } from '@saldacargo/domain-service';

function pluralFiles(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'файл';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'файла';
  return 'файлов';
}

function formatMb(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '0.0 МБ';
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function buildSubject(driverName?: string, regNumber?: string): string {
  const parts = [driverName?.trim(), regNumber?.trim()].filter(Boolean);
  return parts.length > 0
    ? `Документы для пропуска: ${parts.join(' · ')}`
    : 'Документы для оформления пропуска';
}

function buildBody(
  driver?: { name: string; phone: string | null } | null,
  asset?: { reg_number: string; short_name: string } | null,
): string {
  const lines = [
    'Добрый день!',
    '',
    'Направляем пакет документов для оформления пропуска на въезд:',
  ];
  if (driver) lines.push(`• Водитель: ${driver.name}${driver.phone ? ` (${driver.phone})` : ''}`);
  if (asset) lines.push(`• ТС: ${asset.short_name}, госномер ${asset.reg_number}`);
  lines.push('', 'Документы во вложении.');
  return lines.join('\n');
}

function buildSignature(company: PassSendBootstrapData['company']): string {
  const displayName = company.legalEntityName || company.organizationName;
  const reqs = [
    company.inn ? `ИНН ${company.inn}` : null,
    company.kpp ? `КПП ${company.kpp}` : null,
  ].filter(Boolean);
  return ['--', `С уважением, ${displayName}`, ...(reqs.length > 0 ? [reqs.join(' · ')] : [])].join(
    '\n',
  );
}

function MiniappSendDocsInner() {
  const searchParams = useSearchParams();
  const initialDriverId = searchParams.get('driverId') ?? '';
  const initialAssetId = searchParams.get('assetId') ?? '';

  const { data, isLoading, error, refetch } = useQuery<PassSendBootstrapData>({
    queryKey: ['miniapp-pass-docs-bootstrap'],
    queryFn: async () => {
      const res = await fetch('/api/admin/pass-documents/bootstrap');
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || 'Не удалось загрузить данные');
      }
      return (await res.json()) as PassSendBootstrapData;
    },
    staleTime: 30_000,
  });

  const [tab, setTab] = useState<'form' | 'preview'>('form');
  const [customerId, setCustomerId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [assetIdOverride, setAssetIdOverride] = useState<string | null>(initialAssetId || null);
  const [driverIdOverride, setDriverIdOverride] = useState<string | null>(initialDriverId || null);
  const [assetDocIdsOverride, setAssetDocIdsOverride] = useState<Set<string> | null>(null);
  const [driverDocIdsOverride, setDriverDocIdsOverride] = useState<Set<string> | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [bodyEdited, setBodyEdited] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const assetId = useMemo(() => {
    if (assetIdOverride !== null) return assetIdOverride;
    if (!data || data.assets.length === 0) return '';
    const byDriver = initialDriverId
      ? data.assets.find((a) => a.assigned_driver_id === initialDriverId)
      : undefined;
    return byDriver?.id ?? data.assets[0]?.id ?? '';
  }, [assetIdOverride, data, initialDriverId]);

  const driverId = useMemo(() => {
    if (driverIdOverride !== null) return driverIdOverride;
    if (!data || data.drivers.length === 0) return '';
    return data.drivers[0]?.id ?? '';
  }, [driverIdOverride, data]);

  const selectedAsset = useMemo(
    () => data?.assets.find((a) => a.id === assetId) ?? null,
    [data, assetId],
  );
  const selectedDriver = useMemo(
    () => data?.drivers.find((d) => d.id === driverId) ?? null,
    [data, driverId],
  );

  const selectedAssetDocIds = useMemo(
    () =>
      assetDocIdsOverride ??
      new Set((selectedAsset?.documents ?? []).filter((d) => d.is_pass_package).map((d) => d.id)),
    [assetDocIdsOverride, selectedAsset],
  );

  const selectedDriverDocIds = useMemo(
    () =>
      driverDocIdsOverride ??
      new Set((selectedDriver?.documents ?? []).filter((d) => d.is_pass_package).map((d) => d.id)),
    [driverDocIdsOverride, selectedDriver],
  );

  const selectedDocs = useMemo<EntityDocumentRecord[]>(() => {
    const aDocs = (selectedAsset?.documents ?? []).filter((d) => selectedAssetDocIds.has(d.id));
    const dDocs = (selectedDriver?.documents ?? []).filter((d) => selectedDriverDocIds.has(d.id));
    return [...aDocs, ...dDocs];
  }, [selectedAsset, selectedDriver, selectedAssetDocIds, selectedDriverDocIds]);

  const totalBytes = useMemo(
    () => selectedDocs.reduce((sum, d) => sum + (d.file_size_bytes ?? 0), 0),
    [selectedDocs],
  );

  const effectiveSubject = subjectEdited
    ? subject
    : buildSubject(selectedDriver?.name, selectedAsset?.reg_number);
  const effectiveBody = bodyEdited ? bodyText : buildBody(selectedDriver, selectedAsset);

  const canSend =
    !sending &&
    recipientEmail.trim().length > 3 &&
    selectedDocs.length > 0 &&
    totalBytes <= 20 * 1024 * 1024;

  const toggleAssetDoc = (id: string) => {
    const next = new Set(selectedAssetDocIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAssetDocIdsOverride(next);
  };

  const toggleDriverDoc = (id: string) => {
    const next = new Set(selectedDriverDocIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDriverDocIdsOverride(next);
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch('/api/admin/pass-documents/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: recipientEmail.trim(),
          counterpartyId: customerId || null,
          assetId: assetId || null,
          driverId: driverId || null,
          assetDocumentIds: Array.from(selectedAssetDocIds),
          driverDocumentIds: Array.from(selectedDriverDocIds),
          subject: effectiveSubject,
          bodyText: effectiveBody,
          includeSignature,
        }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        error?: string;
        attachmentsCount?: number;
        totalSizeBytes?: number;
      };
      if (!res.ok) throw new Error(result.error || 'Ошибка отправки');
      setSendSuccess(
        `Отправлено ${result.attachmentsCount ?? selectedDocs.length} ${pluralFiles(result.attachmentsCount ?? selectedDocs.length)} на ${recipientEmail.trim()}`,
      );
      void refetch();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs font-semibold text-[#666B73]">Загрузка документов...</div>;
  }

  if (error || !data) {
    return (
      <div className="p-4 text-xs font-semibold text-rose-700">
        {error instanceof Error ? error.message : 'Ошибка загрузки'}
      </div>
    );
  }

  const assetDocs = selectedAsset?.documents ?? [];
  const driverDocs = selectedDriver?.documents ?? [];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-[#F6F7F8] p-3 space-y-3 pb-28">
      {/* Шапка */}
      <div className="bg-white rounded-[18px] border border-[#E7E8EA] px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-sm font-extrabold text-[#111111] truncate">Отправить документы</h1>
          <p className="text-[11px] text-[#666B73] truncate">Пакет на пропуск в 2 клика</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-[#F3F4F6] text-[#111111] shrink-0">
          {selectedDocs.length} ф. · {formatMb(totalBytes)}
        </span>
      </div>

      {/* Табы «Файлы» / «Письмо и отправка» (стиль Т-Банк) */}
      <div className="flex items-center bg-[#EAECEF] rounded-2xl p-1">
        <button
          type="button"
          onClick={() => setTab('form')}
          className={`flex-1 py-2 text-xs rounded-xl transition-all ${
            tab === 'form'
              ? 'bg-white text-[#111111] shadow-xs font-bold'
              : 'text-[#666B73] font-semibold'
          }`}
        >
          Файлы ({selectedDocs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`flex-1 py-2 text-xs rounded-xl transition-all ${
            tab === 'preview'
              ? 'bg-white text-[#111111] shadow-xs font-bold'
              : 'text-[#666B73] font-semibold'
          }`}
        >
          Письмо и отправка
        </button>
      </div>

      {sendSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl px-3.5 py-2.5 text-xs font-bold">
          ✓ {sendSuccess}
        </div>
      )}
      {sendError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold">
          {sendError}
        </div>
      )}

      {tab === 'form' ? (
        <div className="space-y-3">
          {/* 1. Получатель */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-3.5 space-y-2">
            <div className="text-xs font-extrabold text-[#111111]">1. Получатель (Заказчик)</div>
            <select
              value={customerId}
              onChange={(e) => {
                const nextId = e.target.value;
                setCustomerId(nextId);
                const c = data.customers.find((x) => x.id === nextId);
                if (c?.email) setRecipientEmail(c.email);
              }}
              className="w-full bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-3 py-2 text-xs font-semibold text-[#111111]"
            >
              <option value="">— Ввести email вручную —</option>
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="email@company.ru"
              className="w-full bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-3 py-2 text-xs font-medium text-[#111111]"
            />
          </div>

          {/* 2. Машина */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#111111]">2. Машина</span>
              <select
                value={assetId}
                onChange={(e) => {
                  setAssetIdOverride(e.target.value);
                  setAssetDocIdsOverride(null);
                }}
                className="flex-1 max-w-[220px] bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#111111]"
              >
                <option value="">— Без ТС —</option>
                {data.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.reg_number} · {a.short_name}
                  </option>
                ))}
              </select>
            </div>
            {assetDocs.length === 0 ? (
              <p className="text-xs text-[#666B73]">Нет документов ТС</p>
            ) : (
              <div className="space-y-1.5">
                {assetDocs.map((doc) => {
                  const checked = selectedAssetDocIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleAssetDoc(doc.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left ${
                        checked ? 'bg-[#FFFDF0] border-[#F2D544]' : 'bg-white border-[#ECEEF0]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-[5px] border flex items-center justify-center text-[10px] font-black shrink-0 ${
                            checked
                              ? 'bg-[#FFDD2D] border-[#E5C21B] text-[#111111]'
                              : 'bg-white border-[#C8CDD3] text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#22252A] shrink-0">
                          {doc.file_type}
                        </span>
                        <span className="text-xs font-semibold text-[#111111] truncate">
                          {doc.file_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#666B73] shrink-0">
                        {formatMb(doc.file_size_bytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Водитель */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#111111]">3. Водитель</span>
              <select
                value={driverId}
                onChange={(e) => {
                  setDriverIdOverride(e.target.value);
                  setDriverDocIdsOverride(null);
                }}
                className="flex-1 max-w-[220px] bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#111111]"
              >
                <option value="">— Без водителя —</option>
                {data.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            {driverDocs.length === 0 ? (
              <p className="text-xs text-[#666B73]">Нет документов водителя</p>
            ) : (
              <div className="space-y-1.5">
                {driverDocs.map((doc) => {
                  const checked = selectedDriverDocIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDriverDoc(doc.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left ${
                        checked ? 'bg-[#FFFDF0] border-[#F2D544]' : 'bg-white border-[#ECEEF0]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-[5px] border flex items-center justify-center text-[10px] font-black shrink-0 ${
                            checked
                              ? 'bg-[#FFDD2D] border-[#E5C21B] text-[#111111]'
                              : 'bg-white border-[#C8CDD3] text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#22252A] shrink-0">
                          {doc.file_type}
                        </span>
                        <span className="text-xs font-semibold text-[#111111] truncate">
                          {doc.file_name}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#666B73] shrink-0">
                        {formatMb(doc.file_size_bytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTab('preview')}
            className="w-full py-3 rounded-xl bg-[#111111] text-white text-xs font-bold"
          >
            Перейти к письму ({selectedDocs.length} {pluralFiles(selectedDocs.length)} ·{' '}
            {formatMb(totalBytes)}) →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-[18px] border border-[#E7E8EA] overflow-hidden">
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#666B73] w-12 shrink-0">Кому:</span>
              <span className="font-bold text-[#111111] bg-[#FFF7CC] px-2 py-0.5 rounded-md truncate">
                {recipientEmail.trim() || 'не указан'}
              </span>
            </div>
            <input
              type="text"
              value={effectiveSubject}
              onChange={(e) => {
                setSubject(e.target.value);
                setSubjectEdited(true);
              }}
              className="w-full bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-3 py-2 text-xs font-bold text-[#111111]"
            />
            <textarea
              rows={5}
              value={effectiveBody}
              onChange={(e) => {
                setBodyText(e.target.value);
                setBodyEdited(true);
              }}
              className="w-full bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl p-3 text-xs leading-relaxed text-[#111111]"
            />
            <div className="bg-[#F6F7F8] border border-[#E7E8EA] rounded-xl p-2.5">
              <label className="flex items-center gap-2 text-[11px] font-bold text-[#111111]">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                <span>Подпись и реквизиты</span>
              </label>
              {includeSignature && (
                <pre className="text-[11px] text-[#666B73] font-sans whitespace-pre-wrap mt-1">
                  {buildSignature(data.company)}
                </pre>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold bg-[#F3F4F6] border border-[#E2E4E8] text-[#111111]"
                >
                  <span className="max-w-[140px] truncate">{doc.file_name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      doc.entity_kind === 'asset' ? toggleAssetDoc(doc.id) : toggleDriverDoc(doc.id)
                    }
                    className="font-bold opacity-60"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="p-3.5 border-t border-[#ECEEF0] bg-[#FAFAFB] flex items-center justify-between gap-2">
            <span className="text-[11px] text-[#666B73]">{formatMb(totalBytes)} / 20 МБ</span>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleSend}
              className="px-5 py-2.5 rounded-xl bg-[#FFDD2D] hover:bg-[#FCC521] text-[#111111] text-xs font-bold disabled:opacity-45"
            >
              {sending
                ? 'Отправка...'
                : `Отправить ${selectedDocs.length} ${pluralFiles(selectedDocs.length)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MiniappSendDocsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-xs text-[#666B73]">Загрузка...</div>}>
      <MiniappSendDocsInner />
    </Suspense>
  );
}
