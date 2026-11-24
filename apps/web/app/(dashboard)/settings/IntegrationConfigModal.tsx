'use client';

import { useState } from 'react';
import type { IntegrationProvider } from '@saldacargo/shared-types';

export interface IntegrationStatusItem {
  provider: IntegrationProvider;
  is_enabled: boolean;
  has_secrets: boolean;
  source: 'database' | 'env_fallback' | 'none';
  config: Record<string, unknown>;
  updated_at: string | null;
}

interface FieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export const PROVIDER_META: Record<
  IntegrationProvider,
  { title: string; shortDesc: string; icon: string; fields: FieldSpec[] }
> = {
  tbank: {
    title: 'Т-Банк Бизнес API',
    shortDesc: 'Синхронизация баланса и выписки по расчётному счёту',
    icon: 'account_balance',
    fields: [
      {
        key: 'account_number',
        label: 'Номер расчётного счёта (20 цифр)',
        placeholder: '40702810...',
      },
      {
        key: 'token',
        label: 'API Token Т-Банка',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
    ],
  },
  wialon: {
    title: 'Wialon GPS / Мониторинг',
    shortDesc: 'Автосинхронизация пробегов и статусов техники',
    icon: 'satellite_alt',
    fields: [
      { key: 'host', label: 'Сервер Wialon (URL)', placeholder: 'https://host.local4.wialon.host' },
      {
        key: 'token',
        label: 'Wialon Token',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
    ],
  },
  opti24: {
    title: 'Opti24 (Газпромнефть)',
    shortDesc: 'Загрузка транзакций и балансов топливных карт',
    icon: 'local_gas_station',
    fields: [
      { key: 'api_url', label: 'URL API Opti24', placeholder: 'https://...' },
      { key: 'login', label: 'Логин', placeholder: 'user@company.ru', secret: true },
      {
        key: 'password_hash',
        label: 'Хэш пароля',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
      {
        key: 'api_key',
        label: 'API Key',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
    ],
  },
  max_bot: {
    title: 'MAX Bot / Мессенджер',
    shortDesc: 'Алерты, уведомления и MiniApp для водителей',
    icon: 'smart_toy',
    fields: [
      { key: 'chat_id', label: 'ID чата для уведомлений', placeholder: 'Необязательно' },
      {
        key: 'token',
        label: 'Токен бота MAX',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
    ],
  },
  yandex_maps: {
    title: 'Яндекс.Карты',
    shortDesc: 'Геокодирование адресов и расчёт расстояний',
    icon: 'map',
    fields: [
      {
        key: 'api_key',
        label: 'API-ключ Яндекс.Карт',
        placeholder: 'Оставьте пустым, чтобы не менять',
        secret: true,
      },
    ],
  },
  smtp: {
    title: 'Почта SMTP (Mail.ru / Яндекс)',
    shortDesc: 'Отправка документов напрямую с вашего ящика (Mail.ru, Яндекс и др.)',
    icon: 'mail',
    fields: [
      { key: 'host', label: 'SMTP-сервер', placeholder: 'smtp.mail.ru', secret: false },
      { key: 'port', label: 'Порт (465 SSL)', placeholder: '465', secret: false },
      { key: 'user', label: 'Email ящика (логин)', placeholder: 'name@mail.ru', secret: false },
      {
        key: 'pass',
        label: 'Пароль для внешнего приложения',
        placeholder: 'Создаётся в безопасности Mail.ru',
        secret: true,
      },
      {
        key: 'from_name',
        label: 'Имя отправителя (необязательно)',
        placeholder: 'Диспетчерская служба',
        secret: false,
      },
    ],
  },
};

interface Props {
  item: IntegrationStatusItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function buildInitialFields(item: IntegrationStatusItem) {
  const meta = PROVIDER_META[item.provider];
  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const f of meta.fields) {
    if (f.secret) {
      secrets[f.key] = '';
    } else {
      const val = item.config?.[f.key];
      config[f.key] = typeof val === 'string' ? val : '';
    }
  }
  return { config, secrets };
}

export function IntegrationConfigModal({ item, onClose, onSaved }: Props) {
  if (!item) return null;
  return (
    <IntegrationConfigModalBody
      key={`${item.provider}:${item.updated_at ?? 'new'}`}
      item={item}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function IntegrationConfigModalBody({
  item,
  onClose,
  onSaved,
}: {
  item: IntegrationStatusItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = buildInitialFields(item);
  // При первой настройке (source === 'none') включаем интеграцию по умолчанию
  const [isEnabled, setIsEnabled] = useState(item.source === 'none' ? true : item.is_enabled);
  const [configValues, setConfigValues] = useState<Record<string, string>>(initial.config);
  const [secretValues, setSecretValues] = useState<Record<string, string>>(initial.secrets);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const meta = PROVIDER_META[item.provider];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const secretsPayload: Record<string, string> = {};
      for (const [k, v] of Object.entries(secretValues)) {
        if (v.trim().length > 0) secretsPayload[k] = v.trim();
      }
      // Для Т-Банка и Opti24 дублируем account_number / api_url в secrets, если введены секреты
      if (Object.keys(secretsPayload).length > 0) {
        for (const [k, v] of Object.entries(configValues)) {
          if (v.trim().length > 0 && !secretsPayload[k]) {
            secretsPayload[k] = v.trim();
          }
        }
      }

      const res = await fetch(`/api/organization/integrations/${item.provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: isEnabled,
          config: configValues,
          ...(Object.keys(secretsPayload).length > 0 ? { secrets: secretsPayload } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось сохранить интеграцию');
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError('Ошибка сети при сохранении');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-600 text-[20px]">{meta.icon}</span>
            <h3 className="text-sm font-extrabold text-slate-900">{meta.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <span className="text-xs font-bold text-slate-800">Интеграция включена</span>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
          </label>

          {meta.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {field.label}
              </label>
              <input
                type={field.secret ? 'password' : 'text'}
                value={
                  field.secret ? (secretValues[field.key] ?? '') : (configValues[field.key] ?? '')
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (field.secret) {
                    setSecretValues((prev) => ({ ...prev, [field.key]: val }));
                  } else {
                    setConfigValues((prev) => ({ ...prev, [field.key]: val }));
                  }
                }}
                placeholder={
                  field.secret && item.has_secrets
                    ? 'Сохранён — оставьте пустым, чтобы не менять'
                    : field.placeholder
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}

          <p className="text-[11px] text-slate-500">
            Все API-ключи шифруются алгоритмом AES-256-GCM на сервере и никогда не отображаются
            повторно.
          </p>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
