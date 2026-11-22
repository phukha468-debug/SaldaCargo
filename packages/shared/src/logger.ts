const SENSITIVE_KEY_PATTERN =
  /pass|pin|token|secret|apikey|api_key|authorization|cookie|initdata|signature|hash/i;

function maskValue(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[MaxDepth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 500) return value.slice(0, 500) + '...[truncated]';
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => maskValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = maskValue(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  module?: string;
  route?: string;
  userId?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context?: LogContext, err?: unknown) {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };

  if (context) {
    entry.ctx = maskValue(context);
  }

  if (err !== undefined) {
    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        ...(process.env.NODE_ENV !== 'production' && err.stack ? { stack: err.stack } : {}),
      };
    } else {
      entry.error = maskValue(err);
    }
  }

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      emit('debug', message, context);
    }
  },
  info(message: string, context?: LogContext) {
    emit('info', message, context);
  },
  warn(message: string, context?: LogContext, err?: unknown) {
    emit('warn', message, context, err);
  },
  error(message: string, context?: LogContext, err?: unknown) {
    emit('error', message, context, err);
  },
};

/**
 * Опциональная отправка ошибки в Sentry через Envelope API (активируется при наличии SENTRY_DSN).
 * Не требует тяжёлых зависимостей и безопасно игнорируется при отсутствии DSN.
 */
export async function reportError(err: unknown, context?: LogContext): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    const parsed = new URL(dsn);
    const projectId = parsed.pathname.replace(/^\/+/, '');
    const publicKey = parsed.username;
    if (!projectId || !publicKey) return;

    const endpoint = `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`;
    const eventId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`).replace(/-/g, '');
    const errorObj = err instanceof Error ? err : new Error(String(err));

    const header = JSON.stringify({
      event_id: eventId,
      sent_at: new Date().toISOString(),
      dsn,
    });
    const itemHeader = JSON.stringify({ type: 'event' });
    const payload = JSON.stringify({
      event_id: eventId,
      timestamp: Date.now() / 1000,
      platform: 'node',
      level: 'error',
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
      message: errorObj.message,
      exception: {
        values: [
          {
            type: errorObj.name,
            value: errorObj.message,
          },
        ],
      },
      extra: context ? maskValue(context) : undefined,
    });

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=salda-logger/1.0`,
      },
      body: `${header}\n${itemHeader}\n${payload}\n`,
    });
  } catch {
    // Ошибки телеметрии никогда не должны ломать основной запрос
  }
}

/**
 * Отправляет структурированный алерт при падении cron-задачи в логи, Sentry и MAX Bot (администраторам).
 */
export async function notifyCronFailure(
  cronName: string,
  err: unknown,
  recipientMaxIds?: string[],
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Cron failed: ${cronName}`, { module: 'cron', cronName }, err);
  await reportError(err, { module: 'cron', cronName });

  const botToken = process.env.MAX_BOT_TOKEN?.trim();
  if (!botToken || !recipientMaxIds || recipientMaxIds.length === 0) return;

  const text = `🚨 СБОЙ CRON: ${cronName}\nОшибка: ${message}\nВремя (UTC): ${new Date().toISOString()}`;
  await Promise.allSettled(
    recipientMaxIds.map((userId) =>
      fetch(`https://botapi.max.ru/messages?user_id=${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          Authorization: botToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      }),
    ),
  );
}
