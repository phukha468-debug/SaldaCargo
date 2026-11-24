'use client';

import { useMemo, useState } from 'react';
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
  if (driver) {
    lines.push(`• Водитель: ${driver.name}${driver.phone ? ` (${driver.phone})` : ''}`);
  }
  if (asset) {
    lines.push(`• ТС: ${asset.short_name}, госномер ${asset.reg_number}`);
  }
  lines.push('', 'Документы во вложении.');
  return lines.join('\n');
}

function buildSignature(company: PassSendBootstrapData['company']): string {
  const displayName = company.legalEntityName || company.organizationName;
  const reqs = [
    company.inn ? `ИНН ${company.inn}` : null,
    company.kpp ? `КПП ${company.kpp}` : null,
    company.ogrn ? `ОГРН ${company.ogrn}` : null,
  ].filter(Boolean);
  return ['--', `С уважением, ${displayName}`, ...(reqs.length > 0 ? [reqs.join(' · ')] : [])].join(
    '\n',
  );
}

export function SendDocsWorkspace() {
  const searchParams = useSearchParams();
  const initialDriverId = searchParams.get('driverId') ?? '';
  const initialAssetId = searchParams.get('assetId') ?? '';

  const { data, isLoading, error, refetch } = useQuery<PassSendBootstrapData>({
    queryKey: ['pass-documents-bootstrap'],
    queryFn: async () => {
      const res = await fetch('/api/pass-documents/bootstrap');
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Не удалось загрузить данные');
      }
      return (await res.json()) as PassSendBootstrapData;
    },
    staleTime: 30_000,
  });

  const [customerId, setCustomerId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [assetIdOverride, setAssetIdOverride] = useState<string | null>(initialAssetId || null);
  const [driverIdOverride, setDriverIdOverride] = useState<string | null>(initialDriverId || null);
  const [assetDocIdsOverride, setAssetDocIdsOverride] = useState<Set<string> | null>(null);
  const [driverDocIdsOverride, setDriverDocIdsOverride] = useState<Set<string> | null>(null);
  const [subject, setSubject] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [subjectEdited, setSubjectEdited] = useState(false);
  const [bodyEdited, setBodyEdited] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

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

  const selectedCustomer = useMemo(
    () => data?.customers.find((c) => c.id === customerId) ?? null,
    [data, customerId],
  );
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

  const handleSelectAsset = (nextId: string) => {
    setAssetIdOverride(nextId);
    setAssetDocIdsOverride(null);
  };

  const handleSelectDriver = (nextId: string) => {
    setDriverIdOverride(nextId);
    setDriverDocIdsOverride(null);
  };

  const handleSelectCustomer = (nextId: string) => {
    setCustomerId(nextId);
    const c = data?.customers.find((x) => x.id === nextId);
    if (c?.email) setRecipientEmail(c.email);
  };

  const effectiveSubject = subjectEdited
    ? subject
    : buildSubject(selectedDriver?.name, selectedAsset?.reg_number);
  const effectiveBody = bodyEdited ? bodyText : buildBody(selectedDriver, selectedAsset);

  const selectedDocs = useMemo<EntityDocumentRecord[]>(() => {
    const aDocs = (selectedAsset?.documents ?? []).filter((d) => selectedAssetDocIds.has(d.id));
    const dDocs = (selectedDriver?.documents ?? []).filter((d) => selectedDriverDocIds.has(d.id));
    return [...aDocs, ...dDocs];
  }, [selectedAsset, selectedDriver, selectedAssetDocIds, selectedDriverDocIds]);

  const totalBytes = useMemo(
    () => selectedDocs.reduce((sum, d) => sum + (d.file_size_bytes ?? 0), 0),
    [selectedDocs],
  );

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

  const canSend =
    !sending &&
    recipientEmail.trim().length > 3 &&
    selectedDocs.length > 0 &&
    totalBytes <= 20 * 1024 * 1024;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    setSendSuccess(null);
    try {
      const res = await fetch('/api/pass-documents/send', {
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
      if (!res.ok) {
        throw new Error(result.error || 'Не удалось отправить документы');
      }
      setSendSuccess(
        `Отправлено ${result.attachmentsCount ?? selectedDocs.length} ${pluralFiles(result.attachmentsCount ?? selectedDocs.length)} (${formatMb(result.totalSizeBytes ?? totalBytes)}) на ${recipientEmail.trim()}`,
      );
      void refetch();
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm font-semibold text-[#666B73]">
        Загрузка данных для отправки документов...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-white rounded-[18px] border border-[#E7E8EA] text-sm text-rose-700">
        {error instanceof Error ? error.message : 'Ошибка загрузки данных'}
      </div>
    );
  }

  const assetDocs = selectedAsset?.documents ?? [];
  const driverDocs = selectedDriver?.documents ?? [];

  return (
    <div className="min-h-full bg-[#F6F7F8] -m-4 sm:-m-6 p-4 sm:p-6 space-y-3">
      {/* Шапка экрана (стиль Т-Банк) */}
      <div className="bg-white border border-[#E7E8EA] rounded-[18px] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-extrabold text-[#111111] tracking-tight truncate">
            Отправить документы на пропуск
          </h1>
          <p className="text-xs text-[#666B73] truncate">
            Выберите заказчика, ТС и водителя — отмеченные файлы соберутся в одно письмо
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.recentSends.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111111] transition-colors"
            >
              История ({data.recentSends.length})
            </button>
          )}
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#F3F4F6] text-[#111111]">
            {selectedDocs.length} {pluralFiles(selectedDocs.length)} · {formatMb(totalBytes)}
          </span>
        </div>
      </div>

      {/* Спойлер истории последних отправок */}
      {showHistory && data.recentSends.length > 0 && (
        <div className="bg-white border border-[#E7E8EA] rounded-[18px] p-3.5 space-y-1.5">
          <div className="text-xs font-extrabold text-[#111111]">Последние отправки</div>
          <div className="divide-y divide-[#ECEEF0]">
            {data.recentSends.map((item) => (
              <div key={item.id} className="py-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[#111111] truncate">
                  {item.recipient_email}
                </span>
                <span className="text-[#666B73] truncate flex-1">{item.subject}</span>
                <span className="text-[11px] font-semibold text-[#666B73] shrink-0">
                  {item.attachments_count} ф. ·{' '}
                  {new Date(item.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sendSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-[16px] px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-2">
          <span>✓ {sendSuccess}</span>
          <button
            type="button"
            onClick={() => setSendSuccess(null)}
            className="text-emerald-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {sendError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-[16px] px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-2">
          <span>{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="text-rose-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Двухколоночная сетка */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Левая колонка: Выбор получателя, ТС и Водителя */}
        <div className="lg:col-span-6 space-y-3">
          {/* 1. Получатель */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-4 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#111111]">
                1. Получатель (Заказчик)
              </span>
              {selectedCustomer?.contact_person && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#F3F4F6] text-[#111111] border border-[#E5E7EB] truncate max-w-[200px]">
                  {selectedCustomer.contact_person}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-3 py-2 text-xs font-semibold text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
              >
                <option value="">— Ввести email вручную —</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? '' : ' (нет email)'}
                  </option>
                ))}
              </select>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="email@company.ru"
                className="bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-3 py-2 text-xs font-medium text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
              />
            </div>
          </div>

          {/* 2. Машина и документы ТС */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-4 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-extrabold text-[#111111]">2. Машина</span>
                {assetDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAssetDocIdsOverride(
                        selectedAssetDocIds.size < assetDocs.length
                          ? new Set(assetDocs.map((d) => d.id))
                          : new Set(),
                      )
                    }
                    className="text-[11px] font-semibold text-[#111111] underline decoration-[#FFDD2D] decoration-2 underline-offset-2"
                  >
                    {selectedAssetDocIds.size < assetDocs.length ? 'Все' : 'Снять'}
                  </button>
                )}
              </div>
              <select
                value={assetId}
                onChange={(e) => handleSelectAsset(e.target.value)}
                className="flex-1 max-w-[280px] bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
              >
                <option value="">— Без документов ТС —</option>
                {data.assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.reg_number} · {a.short_name} ({a.documents.length})
                  </option>
                ))}
              </select>
            </div>
            {assetDocs.length === 0 ? (
              <p className="text-xs text-[#666B73] bg-[#F6F7F8] rounded-xl px-3 py-2">
                У выбранного ТС нет загруженных документов. Загрузить можно в разделе «Автопарк».
              </p>
            ) : (
              <div className="space-y-1.5">
                {assetDocs.map((doc) => {
                  const checked = selectedAssetDocIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleAssetDoc(doc.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                        checked
                          ? 'bg-[#FFFDF0] border-[#F2D544]'
                          : 'bg-white border-[#ECEEF0] hover:bg-[#F9FAFB]'
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
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#22252A] border border-[#E2E4E8] shrink-0">
                          {doc.file_type}
                        </span>
                        <span className="text-xs font-semibold text-[#111111] truncate">
                          {doc.file_name}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#666B73] shrink-0">
                        {formatMb(doc.file_size_bytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Водитель и его документы */}
          <div className="bg-white rounded-[18px] border border-[#E7E8EA] p-4 space-y-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-extrabold text-[#111111]">3. Водитель</span>
                {driverDocs.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDriverDocIdsOverride(
                        selectedDriverDocIds.size < driverDocs.length
                          ? new Set(driverDocs.map((d) => d.id))
                          : new Set(),
                      )
                    }
                    className="text-[11px] font-semibold text-[#111111] underline decoration-[#FFDD2D] decoration-2 underline-offset-2"
                  >
                    {selectedDriverDocIds.size < driverDocs.length ? 'Все' : 'Снять'}
                  </button>
                )}
              </div>
              <select
                value={driverId}
                onChange={(e) => handleSelectDriver(e.target.value)}
                className="flex-1 max-w-[280px] bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
              >
                <option value="">— Без документов водителя —</option>
                {data.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.documents.length})
                  </option>
                ))}
              </select>
            </div>
            {driverDocs.length === 0 ? (
              <p className="text-xs text-[#666B73] bg-[#F6F7F8] rounded-xl px-3 py-2">
                У выбранного водителя нет документов. Загрузить можно в разделе «Персонал».
              </p>
            ) : (
              <div className="space-y-1.5">
                {driverDocs.map((doc) => {
                  const checked = selectedDriverDocIds.has(doc.id);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDriverDoc(doc.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                        checked
                          ? 'bg-[#FFFDF0] border-[#F2D544]'
                          : 'bg-white border-[#ECEEF0] hover:bg-[#F9FAFB]'
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
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#F2F3F5] text-[#22252A] border border-[#E2E4E8] shrink-0">
                          {doc.file_type}
                        </span>
                        <span className="text-xs font-semibold text-[#111111] truncate">
                          {doc.file_name}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#666B73] shrink-0">
                        {formatMb(doc.file_size_bytes)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка: Живой предпросмотр письма */}
        <div className="lg:col-span-6 bg-white rounded-[18px] border border-[#E7E8EA] shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-[#FAFAFB] border-b border-[#ECEEF0] flex items-center justify-between">
            <span className="text-xs font-extrabold text-[#111111]">Живой предпросмотр письма</span>
            {subjectEdited || bodyEdited ? (
              <button
                type="button"
                onClick={() => {
                  setSubjectEdited(false);
                  setBodyEdited(false);
                }}
                className="text-[11px] font-semibold text-[#111111] underline decoration-[#FFDD2D] decoration-2 underline-offset-2"
              >
                Сбросить шаблон
              </button>
            ) : (
              <span className="text-[10px] text-[#666B73]">Автоподстановка</span>
            )}
          </div>

          <div className="p-4 space-y-3">
            <div className="space-y-1.5 text-xs border-b border-[#ECEEF0] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-[#666B73] w-12 shrink-0 font-medium">Кому:</span>
                <span className="text-[#111111] font-bold bg-[#FFF7CC] px-2 py-0.5 rounded-md truncate">
                  {recipientEmail.trim() || 'укажите email'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[#666B73] w-12 shrink-0 font-medium">Тема:</span>
                <input
                  type="text"
                  value={effectiveSubject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setSubjectEdited(true);
                  }}
                  className="flex-1 bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
                />
              </div>
            </div>

            <textarea
              rows={6}
              value={effectiveBody}
              onChange={(e) => {
                setBodyText(e.target.value);
                setBodyEdited(true);
              }}
              className="w-full bg-[#F6F7F8] border border-[#DFE1E5] rounded-xl p-3 text-xs leading-relaxed font-medium text-[#111111] focus:bg-white focus:border-[#111111] focus:outline-none"
            />

            {/* Подпись и реквизиты */}
            <div className="bg-[#F6F7F8] border border-[#E7E8EA] rounded-xl p-3">
              <label className="flex items-center gap-2 text-[11px] font-bold text-[#111111] cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Подпись и реквизиты компании</span>
              </label>
              {includeSignature && (
                <pre className="text-[11px] text-[#666B73] font-sans whitespace-pre-wrap leading-snug">
                  {buildSignature(data.company)}
                </pre>
              )}
            </div>

            {/* Чипы вложений */}
            <div>
              <div className="text-[11px] font-bold text-[#666B73] mb-1.5">
                Вложения ({selectedDocs.length} · {formatMb(totalBytes)}):
              </div>
              {selectedDocs.length === 0 ? (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-medium">
                  Отметьте хотя бы один файл слева
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selectedDocs.map((doc) => (
                    <span
                      key={doc.id}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold bg-[#F3F4F6] border border-[#E2E4E8] text-[#111111]"
                    >
                      <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-white border border-[#E2E4E8]">
                        {doc.file_type}
                      </span>
                      <span className="max-w-[160px] truncate">{doc.file_name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          doc.entity_kind === 'asset'
                            ? toggleAssetDoc(doc.id)
                            : toggleDriverDoc(doc.id)
                        }
                        className="opacity-60 hover:opacity-100 hover:text-rose-600 font-bold leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Футер с кнопкой отправки */}
          <div className="px-4 py-3 border-t border-[#ECEEF0] bg-[#FAFAFB] flex items-center justify-between gap-2">
            <span
              className={`text-[11px] ${totalBytes > 20 * 1024 * 1024 ? 'text-rose-600 font-bold' : 'text-[#666B73]'}`}
            >
              Лимит 20 МБ · <b className="text-[#111111]">{formatMb(totalBytes)}</b>
            </span>
            <button
              type="button"
              disabled={!canSend}
              onClick={handleSend}
              className="px-5 py-2.5 rounded-xl bg-[#FFDD2D] hover:bg-[#FCC521] active:bg-[#F5BA14] text-[#111111] text-xs font-bold shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {sending
                ? 'Отправка...'
                : `Отправить ${selectedDocs.length} ${pluralFiles(selectedDocs.length)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
