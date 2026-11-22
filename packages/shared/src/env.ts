import { z } from 'zod';

/**
 * Контролируемая ошибка конфигурации окружения для опциональных интеграций.
 * API-роуты должны маппить её на HTTP 503 Service Unavailable.
 */
export class EnvConfigError extends Error {
  public readonly statusCode = 503;
  public readonly integration: string;

  constructor(integration: string, message: string) {
    super(message);
    this.name = 'EnvConfigError';
    this.integration = integration;
  }
}

export function isEnvConfigError(err: unknown): err is EnvConfigError {
  return err instanceof EnvConfigError;
}

const coreEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_URL is required' })
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ required_error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required' })
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY must not be empty'),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

/**
 * Fail-fast валидация обязательных серверных переменных окружения (Supabase).
 */
export function getCoreEnv(env: NodeJS.ProcessEnv = process.env): CoreEnv {
  const parsed = coreEnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid core environment configuration: ${details}`);
  }
  return parsed.data;
}

const wialonEnvSchema = z.object({
  host: z.string().url().default('https://host.local4.wialon.host'),
  token: z.string().min(1),
});

export type WialonEnv = z.infer<typeof wialonEnvSchema>;

export function getWialonEnv(env: NodeJS.ProcessEnv = process.env): WialonEnv | null {
  const parsed = wialonEnvSchema.safeParse({
    host: env.WIALON_HOST?.trim() || undefined,
    token: env.WIALON_TOKEN?.trim(),
  });
  return parsed.success ? parsed.data : null;
}

export function requireWialonEnv(env: NodeJS.ProcessEnv = process.env): WialonEnv {
  const config = getWialonEnv(env);
  if (!config) {
    throw new EnvConfigError(
      'wialon',
      'Интеграция Wialon не настроена: задайте WIALON_TOKEN (и при необходимости WIALON_HOST) в переменных окружения.',
    );
  }
  return config;
}

const tbankEnvSchema = z.object({
  token: z.string().min(1),
  accountNumber: z.string().min(1).optional(),
});

export type TBankEnv = z.infer<typeof tbankEnvSchema>;

export function getTBankEnv(env: NodeJS.ProcessEnv = process.env): TBankEnv | null {
  const parsed = tbankEnvSchema.safeParse({
    token: env.TBANK_API_TOKEN?.trim(),
    accountNumber: env.TBANK_ACCOUNT_NUMBER?.trim() || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function requireTBankEnv(env: NodeJS.ProcessEnv = process.env): TBankEnv {
  const config = getTBankEnv(env);
  if (!config) {
    throw new EnvConfigError(
      'tbank',
      'Интеграция Т-Банк не настроена: задайте TBANK_API_TOKEN (и при необходимости TBANK_ACCOUNT_NUMBER) в переменных окружения.',
    );
  }
  return config;
}

const opti24EnvSchema = z.object({
  apiUrl: z.string().url(),
  login: z.string().min(1),
  passwordHash: z.string().min(1),
  apiKey: z.string().min(1),
});

export type Opti24Env = z.infer<typeof opti24EnvSchema>;

export function getOpti24Env(env: NodeJS.ProcessEnv = process.env): Opti24Env | null {
  const parsed = opti24EnvSchema.safeParse({
    apiUrl: env.OPTI24_API_URL?.trim(),
    login: env.OPTI24_LOGIN?.trim(),
    passwordHash: env.OPTI24_PASSWORD_HASH?.trim(),
    apiKey: env.OPTI24_API_KEY?.trim(),
  });
  return parsed.success ? parsed.data : null;
}

export function requireOpti24Env(env: NodeJS.ProcessEnv = process.env): Opti24Env {
  const config = getOpti24Env(env);
  if (!config) {
    throw new EnvConfigError(
      'opti24',
      'Интеграция Opti24 (Газпромнефть) не настроена: задайте OPTI24_API_URL, OPTI24_LOGIN, OPTI24_PASSWORD_HASH и OPTI24_API_KEY в переменных окружения.',
    );
  }
  return config;
}

const maxBotEnvSchema = z.object({
  token: z.string().min(1),
});

export type MaxBotEnv = z.infer<typeof maxBotEnvSchema>;

export function getMaxBotEnv(env: NodeJS.ProcessEnv = process.env): MaxBotEnv | null {
  const parsed = maxBotEnvSchema.safeParse({
    token: env.MAX_BOT_TOKEN?.trim(),
  });
  return parsed.success ? parsed.data : null;
}

export function requireMaxBotEnv(env: NodeJS.ProcessEnv = process.env): MaxBotEnv {
  const config = getMaxBotEnv(env);
  if (!config) {
    throw new EnvConfigError(
      'max_bot',
      'Интеграция MAX Bot не настроена: задайте MAX_BOT_TOKEN в переменных окружения.',
    );
  }
  return config;
}

const yandexMapsEnvSchema = z.object({
  apiKey: z.string().min(1),
});

export type YandexMapsEnv = z.infer<typeof yandexMapsEnvSchema>;

export function getYandexMapsEnv(env: NodeJS.ProcessEnv = process.env): YandexMapsEnv | null {
  const parsed = yandexMapsEnvSchema.safeParse({
    apiKey: env.YANDEX_MAPS_API_KEY?.trim(),
  });
  return parsed.success ? parsed.data : null;
}

export function getCronSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.CRON_SECRET?.trim();
  return value ? value : null;
}

export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.AUTH_SESSION_SECRET?.trim();
  if (!value || value.length < 32) return null;
  return value;
}

export function requireSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = getSessionSecret(env);
  if (!secret) {
    throw new EnvConfigError(
      'auth_session',
      'AUTH_SESSION_SECRET не настроен или короче 32 символов. Задайте криптостойкий секрет в переменных окружения.',
    );
  }
  return secret;
}

export function getEncryptionMasterKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.ENCRYPTION_MASTER_KEY?.trim();
  if (!value || value.length < 32) return null;
  return value;
}

export function requireEncryptionMasterKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = getEncryptionMasterKey(env);
  if (!key) {
    throw new EnvConfigError(
      'encryption',
      'ENCRYPTION_MASTER_KEY не настроен или короче 32 символов. Задайте криптостойкий ключ в переменных окружения.',
    );
  }
  return key;
}
