import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, logger } from '@saldacargo/shared';
import { getIntegrationConfig } from '../../organization/integrations';
import { SmtpEmailProvider } from './smtpProvider';
import type { EmailProvider, SendEmailPayload, SendEmailResult } from './types';

interface SmtpCredentials {
  pass?: string;
  [key: string]: string | undefined;
}

interface SmtpConfig {
  host?: string;
  port?: string | number;
  user?: string;
  from_name?: string;
  [key: string]: unknown;
}

interface ResendCredentials {
  api_key?: string;
  from_email?: string;
  [key: string]: string | undefined;
}

interface ResendConfig {
  from_email?: string;
  [key: string]: unknown;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

export class ResendEmailProvider implements EmailProvider {
  public readonly name = 'resend';
  public readonly fromEmail: string;
  private readonly apiKey: string;

  constructor(apiKey: string, fromEmail: string) {
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [payload.to],
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
        ...(payload.attachments && payload.attachments.length > 0
          ? {
              attachments: payload.attachments.map((att) => ({
                filename: att.filename,
                content: att.content.toString('base64'),
                ...(att.contentType ? { content_type: att.contentType } : {}),
              })),
            }
          : {}),
      }),
    });

    const rawText = await response.text();
    let parsed: { id?: string; message?: string; name?: string } = {};
    try {
      parsed = JSON.parse(rawText) as { id?: string; message?: string; name?: string };
    } catch {
      parsed = {};
    }

    if (!response.ok) {
      logger.error('Resend API error', {
        status: response.status,
        errorName: parsed.name,
        errorMessage: parsed.message ?? rawText.slice(0, 300),
      });
      throw new ApiError(
        502,
        parsed.message
          ? `Ошибка почтового провайдера Resend: ${parsed.message}`
          : 'Не удалось отправить письмо через Resend',
        'EMAIL_PROVIDER_ERROR',
      );
    }

    return {
      provider: this.name,
      messageId: parsed.id ?? null,
    };
  }
}

/**
 * Резолвит почтовый провайдер организации из `organization_integrations`:
 * 1) Сначала проверяет `smtp` (Mail.ru / Яндекс / корпоративный SMTP) — приоритетный вариант.
 * 2) Затем проверяет `resend`.
 * 3) Фоллбэк на `process.env` (`SMTP_*` или `RESEND_*`) разрешён ТОЛЬКО в dev-режиме (`NODE_ENV !== 'production'`).
 */
export async function resolveEmailProvider(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<EmailProvider> {
  // 1. Проверяем SMTP в organization_integrations
  const smtpIntegration = await getIntegrationConfig<SmtpCredentials, SmtpConfig>(
    supabase,
    organizationId,
    'smtp',
  );

  if (smtpIntegration.isEnabled) {
    const pass = smtpIntegration.credentials.pass?.trim();
    const user =
      typeof smtpIntegration.config.user === 'string'
        ? smtpIntegration.config.user.trim()
        : undefined;
    const host =
      (typeof smtpIntegration.config.host === 'string' && smtpIntegration.config.host.trim()) ||
      'smtp.mail.ru';
    const rawPort = Number(smtpIntegration.config.port ?? 465);
    const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 465;
    const fromName =
      typeof smtpIntegration.config.from_name === 'string'
        ? smtpIntegration.config.from_name.trim()
        : undefined;

    if (user && pass) {
      return new SmtpEmailProvider({
        host,
        port,
        secure: port === 465,
        user,
        pass,
        fromName,
      });
    }
  }

  // 2. Проверяем Resend в organization_integrations
  const integration = await getIntegrationConfig<ResendCredentials, ResendConfig>(
    supabase,
    organizationId,
    'resend',
  );

  const dbApiKey = integration.isEnabled ? integration.credentials.api_key?.trim() : undefined;
  const dbFromEmail =
    (typeof integration.config.from_email === 'string'
      ? integration.config.from_email.trim()
      : undefined) || integration.credentials.from_email?.trim();

  if (dbApiKey) {
    const fromEmail = dbFromEmail || process.env.RESEND_FROM_EMAIL?.trim();
    if (!fromEmail) {
      throw new ApiError(
        503,
        'В настройках интеграции Resend не указан адрес отправителя (from_email).',
        'EMAIL_FROM_MISSING',
      );
    }
    return new ResendEmailProvider(dbApiKey, fromEmail);
  }

  // 3. Dev-фоллбэк из .env.local (только не в production)
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const envSmtpUser = process.env.SMTP_USER?.trim();
    const envSmtpPass = process.env.SMTP_PASS?.trim();
    if (envSmtpUser && envSmtpPass) {
      const envHost = process.env.SMTP_HOST?.trim() || 'smtp.mail.ru';
      const envPort = Number(process.env.SMTP_PORT || 465) || 465;
      return new SmtpEmailProvider({
        host: envHost,
        port: envPort,
        secure: envPort === 465,
        user: envSmtpUser,
        pass: envSmtpPass,
        fromName: process.env.SMTP_FROM_NAME?.trim(),
      });
    }

    const envApiKey = process.env.RESEND_API_KEY?.trim();
    const envFromEmail =
      process.env.RESEND_FROM_EMAIL?.trim() || 'SALDA Docs <onboarding@resend.dev>';
    if (envApiKey) {
      return new ResendEmailProvider(envApiKey, envFromEmail);
    }
  }

  throw new ApiError(
    503,
    'Почтовая интеграция не настроена. Подключите «Почта SMTP (Mail.ru / Яндекс)» в разделе «Настройки → Интеграции».',
    'EMAIL_NOT_CONFIGURED',
  );
}
