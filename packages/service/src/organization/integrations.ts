/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ORGANIZATION_ID,
  decryptJsonSecrets,
  encryptJsonSecrets,
  getMaxBotEnv,
  getOpti24Env,
  getTBankEnv,
  getWialonEnv,
  logger,
} from '@saldacargo/shared';
import type { IntegrationProvider } from '@saldacargo/shared-types';

export interface ResolvedIntegration<
  TCredentials extends Record<string, string | undefined> = Record<string, string | undefined>,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> {
  provider: IntegrationProvider;
  isEnabled: boolean;
  source: 'database' | 'env_fallback' | 'none';
  config: TConfig;
  credentials: TCredentials;
}

export interface TBankIntegrationCredentials {
  token?: string;
  account_number?: string;
  [key: string]: string | undefined;
}

export interface WialonIntegrationCredentials {
  token?: string;
  [key: string]: string | undefined;
}

export interface Opti24IntegrationCredentials {
  api_key?: string;
  login?: string;
  password_hash?: string;
  api_url?: string;
  [key: string]: string | undefined;
}

export interface MaxBotIntegrationCredentials {
  token?: string;
  chat_id?: string;
  [key: string]: string | undefined;
}

function getTenant1EnvFallback(
  provider: IntegrationProvider,
): { credentials: Record<string, string | undefined>; config: Record<string, unknown> } | null {
  switch (provider) {
    case 'tbank': {
      const env = getTBankEnv();
      if (!env?.token) return null;
      return {
        credentials: { token: env.token, account_number: env.accountNumber },
        config: { account_number: env.accountNumber },
      };
    }
    case 'wialon': {
      const env = getWialonEnv();
      if (!env?.token) return null;
      return {
        credentials: { token: env.token },
        config: { host: env.host },
      };
    }
    case 'opti24': {
      const env = getOpti24Env();
      if (!env?.apiKey) return null;
      return {
        credentials: {
          api_key: env.apiKey,
          login: env.login,
          password_hash: env.passwordHash,
          api_url: env.apiUrl,
        },
        config: { api_url: env.apiUrl },
      };
    }
    case 'max_bot': {
      const env = getMaxBotEnv();
      if (!env?.token) return null;
      return {
        credentials: { token: env.token },
        config: {},
      };
    }
    default:
      return null;
  }
}

/**
 * Загружает конфигурацию и расшифрованные секреты интеграции для конкретной организации.
 * ВАЖНО (изоляция тенантов):
 * - Для всех новых организаций секреты берутся СТРОГО из `organization_integrations`.
 * - Fallback на `process.env` разрешён ТОЛЬКО для Тенанта №1 (`DEFAULT_ORGANIZATION_ID`)
 *   до переноса его ключей в БД через админку.
 */
export async function getIntegrationConfig<
  TCredentials extends Record<string, string | undefined> = Record<string, string | undefined>,
  TConfig extends Record<string, unknown> = Record<string, unknown>,
>(
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
  provider: IntegrationProvider,
): Promise<ResolvedIntegration<TCredentials, TConfig>> {
  const { data, error } = await (supabase.from('organization_integrations') as any)
    .select('provider, is_enabled, config, encrypted_secrets')
    .eq('organization_id', organizationId)
    .eq('provider', provider)
    .maybeSingle();

  if (!error && data) {
    if (!data.is_enabled) {
      return {
        provider,
        isEnabled: false,
        source: 'database',
        config: (data.config ?? {}) as TConfig,
        credentials: {} as TCredentials,
      };
    }

    let decrypted: Record<string, string> = {};
    if (typeof data.encrypted_secrets === 'string' && data.encrypted_secrets.length > 0) {
      try {
        decrypted = decryptJsonSecrets<Record<string, string>>(data.encrypted_secrets);
      } catch (err) {
        logger.error(
          'Failed to decrypt organization integration credentials',
          { organizationId, provider },
          err,
        );
        return {
          provider,
          isEnabled: false,
          source: 'database',
          config: (data.config ?? {}) as TConfig,
          credentials: {} as TCredentials,
        };
      }
    }

    return {
      provider,
      isEnabled: true,
      source: 'database',
      config: (data.config ?? {}) as TConfig,
      credentials: decrypted as TCredentials,
    };
  }

  // Безопасный fallback на env ТОЛЬКО для Тенанта №1
  if (organizationId === DEFAULT_ORGANIZATION_ID) {
    const envFallback = getTenant1EnvFallback(provider);
    if (envFallback) {
      return {
        provider,
        isEnabled: true,
        source: 'env_fallback',
        config: envFallback.config as TConfig,
        credentials: envFallback.credentials as TCredentials,
      };
    }
  }

  return {
    provider,
    isEnabled: false,
    source: 'none',
    config: {} as TConfig,
    credentials: {} as TCredentials,
  };
}

/**
 * Сохраняет (или обновляет) зашифрованные секреты и публичную конфигурацию интеграции организации.
 */
export async function upsertIntegrationConfig(
  supabase: SupabaseClient<any, any, any>,
  organizationId: string,
  provider: IntegrationProvider,
  payload: {
    isEnabled: boolean;
    config?: Record<string, unknown>;
    credentials?: Record<string, string>;
  },
): Promise<{ ok: boolean; error?: string }> {
  const encrypted =
    payload.credentials && Object.keys(payload.credentials).length > 0
      ? encryptJsonSecrets(payload.credentials)
      : null;

  const updateRow: Record<string, unknown> = {
    organization_id: organizationId,
    provider,
    is_enabled: payload.isEnabled,
    config: payload.config ?? {},
    updated_at: new Date().toISOString(),
  };

  if (encrypted !== null) {
    updateRow.encrypted_secrets = encrypted;
  }

  const { error } = await (supabase.from('organization_integrations') as any).upsert(updateRow, {
    onConflict: 'organization_id,provider',
  });

  if (error) {
    logger.error('Failed to upsert organization integration', { organizationId, provider }, error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
