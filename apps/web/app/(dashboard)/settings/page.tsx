'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MODULE_META, SALDA_MODULES, type SaldaModule } from '@saldacargo/shared';
import { cn } from '@saldacargo/ui';
import { LegalEntityModal, type LegalEntityItem } from './LegalEntityModal';
import {
  IntegrationConfigModal,
  PROVIDER_META,
  type IntegrationStatusItem,
} from './IntegrationConfigModal';

interface SettingsResponse {
  organization: {
    id: string;
    slug: string;
    name: string;
    enabled_modules: SaldaModule[];
    settings: {
      branding?: {
        short_name?: string;
        logo_url?: string;
        primary_color?: string;
        timezone?: string;
      };
      finance?: {
        cube_fuel_price_per_liter?: number;
        diesel_fuel_price_per_liter?: number;
      };
    };
  };
  integrations: IntegrationStatusItem[];
  can_edit: boolean;
}

type SettingsTab = 'company' | 'modules' | 'integrations';

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>('company');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Company form state
  const [companyName, setCompanyName] = useState('');
  const [shortName, setShortName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Yekaterinburg');
  const [cubeFuelPrice, setCubeFuelPrice] = useState('60');
  const [dieselFuelPrice, setDieselFuelPrice] = useState('82');
  const [selectedModules, setSelectedModules] = useState<SaldaModule[]>([]);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [editingEntity, setEditingEntity] = useState<LegalEntityItem | null>(null);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<IntegrationStatusItem | null>(null);

  const { data, isLoading, refetch } = useQuery<SettingsResponse>({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const res = await fetch('/api/organization/settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const { data: legalData, refetch: refetchLegal } = useQuery<{ items: LegalEntityItem[] }>({
    queryKey: ['organization-legal-entities'],
    queryFn: async () => {
      const res = await fetch('/api/organization/legal-entities');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!data?.organization) return;
    const org = data.organization;
    setCompanyName(org.name ?? '');
    setShortName(org.settings?.branding?.short_name ?? '');
    setTimezone(org.settings?.branding?.timezone ?? 'Asia/Yekaterinburg');
    setCubeFuelPrice(String(org.settings?.finance?.cube_fuel_price_per_liter ?? 60));
    setDieselFuelPrice(String(org.settings?.finance?.diesel_fuel_price_per_liter ?? 82));
    setSelectedModules(org.enabled_modules ?? []);
  }, [data]);

  const canEdit = Boolean(data?.can_edit);

  function showToast(type: 'ok' | 'err', text: string) {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  }

  async function saveCompanyProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName.trim(),
          settings: {
            branding: {
              short_name: shortName.trim(),
              timezone: timezone.trim(),
            },
            finance: {
              cube_fuel_price_per_liter: Number(cubeFuelPrice) || 60,
              diesel_fuel_price_per_liter: Number(dieselFuelPrice) || 82,
            },
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast('err', json.error || 'Не удалось сохранить настройки');
        return;
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['organization-context'] }),
      ]);
      showToast('ok', 'Настройки компании сохранены');
    } catch {
      showToast('err', 'Ошибка сети при сохранении');
    } finally {
      setSaving(false);
    }
  }

  async function saveModules() {
    if (!canEdit) return;
    if (selectedModules.length === 0) {
      showToast('err', 'Должен быть включён хотя бы один модуль');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_modules: selectedModules }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast('err', json.error || 'Не удалось обновить модули');
        return;
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['organization-context'] }),
      ]);
      showToast('ok', 'Состав модулей обновлён');
    } catch {
      showToast('err', 'Ошибка сети при сохранении модулей');
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(mod: SaldaModule) {
    if (!canEdit) return;
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 text-center text-sm text-slate-500">
        Загрузка настроек организации...
      </div>
    );
  }

  const legalEntities = legalData?.items ?? [];
  const integrations = data?.integrations ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* ── Top Header & Tabs (1-line compact bar) ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-600 text-[22px]">settings</span>
          <span className="font-extrabold text-sm text-slate-900">
            {data?.organization?.name || 'Организация'}
          </span>
          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
            {data?.organization?.slug}
          </span>
          {!canEdit && (
            <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
              Только просмотр (нужна роль owner)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(
            [
              { id: 'company', label: 'Компания и юрлица', icon: 'business' },
              { id: 'modules', label: 'Модули', icon: 'extension' },
              { id: 'integrations', label: 'Интеграции', icon: 'hub' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer',
                tab === t.id
                  ? 'bg-white text-sky-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div
          className={cn(
            'px-4 py-2.5 rounded-xl text-xs font-bold border',
            statusMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700',
          )}
        >
          {statusMsg.text}
        </div>
      )}

      {/* ── Tab 1: Компания, брендинг и юридические лица ─────────────── */}
      {tab === 'company' && (
        <div className="space-y-4">
          <form
            onSubmit={saveCompanyProfile}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Профиль и параметры компании
              </h2>
              {canEdit && (
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Полное название
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Краткое имя (в шапке)
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="SALDA"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  Часовой пояс
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Куб ₽/л</label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={!canEdit}
                    value={cubeFuelPrice}
                    onChange={(e) => setCubeFuelPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ДТ ₽/л</label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={!canEdit}
                    value={dieselFuelPrice}
                    onChange={(e) => setDieselFuelPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Компактный 1-строчный список юрлиц */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Юридические лица и реквизиты
                </h2>
                <span className="text-[11px] font-bold text-slate-400">
                  ({legalEntities.length})
                </span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntity(null);
                    setIsEntityModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px]">add</span>
                  Добавить юрлицо
                </button>
              )}
            </div>

            {legalEntities.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                Юридические лица не добавлены. Нажмите «Добавить юрлицо», чтобы указать реквизиты.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {legalEntities.map((le) => (
                  <div
                    key={le.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border shrink-0',
                          le.is_active === false
                            ? 'bg-slate-100 text-slate-400 border-slate-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200',
                        )}
                      >
                        {le.type === 'ip' ? 'ИП' : le.type === 'ooo' ? 'ООО' : le.type}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate">{le.name}</span>
                      {le.inn && (
                        <span className="text-xs font-mono text-slate-500 shrink-0">
                          ИНН {le.inn}
                        </span>
                      )}
                      {le.ogrn && (
                        <span className="hidden md:inline text-xs font-mono text-slate-400 shrink-0">
                          ОГРН {le.ogrn}
                        </span>
                      )}
                      {le.bank_name && (
                        <span className="hidden lg:inline text-xs text-slate-500 truncate">
                          · {le.bank_name}
                        </span>
                      )}
                      {le.edo_id && (
                        <span className="hidden xl:inline text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                          ЭДО
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEntity(le);
                          setIsEntityModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-sky-400 text-xs font-bold text-slate-700 hover:text-sky-700 shrink-0 cursor-pointer"
                      >
                        Реквизиты
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Модули (Feature Flags) ────────────────────────────── */}
      {tab === 'modules' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Активные модули платформы ({selectedModules.length} из {SALDA_MODULES.length})
            </h2>
            {canEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={saveModules}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Сохранение...' : 'Сохранить модули'}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {SALDA_MODULES.map((modId) => {
              const meta = MODULE_META[modId];
              const enabled = selectedModules.includes(modId);
              return (
                <div
                  key={modId}
                  onClick={() => toggleModule(modId)}
                  className={cn(
                    'flex items-center justify-between gap-4 px-4 py-3 transition-colors',
                    canEdit ? 'cursor-pointer hover:bg-slate-50/80' : '',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full shrink-0',
                        enabled ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                    />
                    <span className="text-sm font-bold text-slate-900 shrink-0">{meta.label}</span>
                    <span className="text-xs text-slate-500 truncate hidden sm:inline">
                      — {meta.description}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!canEdit}
                    aria-pressed={enabled}
                    className={cn(
                      'w-10 h-5 rounded-full transition-colors p-0.5 shrink-0 flex items-center',
                      enabled ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start',
                    )}
                  >
                    <span className="w-4 h-4 rounded-full bg-white shadow-xs block" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab 3: Интеграции (AES-256-GCM) ──────────────────────────── */}
      {tab === 'integrations' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/70">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
              Внешние интеграции организации
            </h2>
            <span className="text-[11px] text-slate-500">
              Секреты шифруются AES-256-GCM и изолированы по компании
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {integrations.map((item) => {
              const meta = PROVIDER_META[item.provider];
              return (
                <div
                  key={item.provider}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="material-symbols-outlined text-slate-500 text-[19px] shrink-0">
                      {meta.icon}
                    </span>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{meta.title}</span>
                    <span className="text-xs text-slate-500 truncate hidden md:inline">
                      · {meta.shortDesc}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.is_enabled ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {item.source === 'env_fallback' ? 'Активна (env)' : 'Подключена'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Отключена
                      </span>
                    )}

                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingIntegration(item)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-sky-400 text-xs font-bold text-slate-700 hover:text-sky-700 cursor-pointer"
                      >
                        Настроить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      <LegalEntityModal
        isOpen={isEntityModalOpen}
        entity={editingEntity}
        onClose={() => setIsEntityModalOpen(false)}
        onSaved={() => {
          refetchLegal();
          showToast('ok', 'Реквизиты юридического лица сохранены');
        }}
      />

      <IntegrationConfigModal
        item={editingIntegration}
        onClose={() => setEditingIntegration(null)}
        onSaved={() => {
          refetch();
          showToast('ok', 'Настройки интеграции сохранены');
        }}
      />
    </div>
  );
}
