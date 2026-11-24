import type { SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { ApiError, logger } from '@saldacargo/shared';
import { getIntegrationConfig } from '../../organization/integrations';
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

export interface SmtpProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
}

export class SmtpEmailProvider implements EmailProvider {
  public readonly name = 'smtp';
  public readonly fromEmail: string;
  private readonly cfg: SmtpProviderConfig;

  constructor(cfg: SmtpProviderConfig) {
    this.cfg = cfg;
    this.fromEmail = cfg.fromName?.trim()
      ? `"${cfg.fromName.trim().replace(/"/g, '')}" <${cfg.user}>`
      : cfg.user;
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const transporter = nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: {
        user: this.cfg.user,
        pass: this.cfg.pass,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    try {
      const info = await transporter.sendMail({
        from: this.fromEmail,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        ...(payload.attachments && payload.attachments.length > 0
          ? {
              attachments: payload.attachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                ...(att.contentType ? { contentType: att.contentType } : {}),
              })),
            }
          : {}),
      });

      return {
        provider: this.name,
        messageId: info.messageId ?? null,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'SMTP error';
      logger.error('SMTP sendMail error', { host: this.cfg.host, port: this.cfg.port, message });
      throw new ApiError(
        502,
        `Ошибка отправки через SMTP (${this.cfg.host}): ${message}`,
        'SMTP_PROVIDER_ERROR',
      );
    }
  }
}

/**
 * Резолвит почтовый провайдер организации из `organization_integrations`:
 * 1) Проверяет `smtp` (Mail.ru / Яндекс / корпоративный SMTP).
 * 2) Фоллбэк на `process.env` (`SMTP_*`) разрешён ТОЛЬКО в dev-режиме (`NODE_ENV !== 'production'`).
 */
export async function resolveEmailProvider(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<EmailProvider> {
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

  // Dev-фоллбэк из .env.local (только не в production)
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
  }

  throw new ApiError(
    503,
    'Почтовая интеграция не настроена. Подключите «Почта SMTP (Mail.ru / Яндекс)» в разделе «Настройки → Интеграции».',
    'EMAIL_NOT_CONFIGURED',
  );
}
